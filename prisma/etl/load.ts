// ETL LOAD — writes the transform output into a v2 database, in FK/path order,
// idempotently (upsert by deterministic id / legacyId). Re-runnable: refine
// mapping.ts, re-run, no duplicates.
//
// SAFETY: targets a DEDICATED env var ETL_TARGET_URL (never a silent fallback to
// DATABASE_URL_V2). The target must already be MIGRATED + SEEDED (npm run seed:v2)
// so the global catalog + global root exist.
//
// Run: ETL_TARGET_URL="postgres://…" npm run etl:load

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { PrismaClient } from "../generated/v2-client";
import { transform, type V1Dump } from "./transform";

const TARGET = process.env.ETL_TARGET_URL;
if (!TARGET) {
  console.error("Refusing to run: set ETL_TARGET_URL to the target DB (never falls back to DATABASE_URL_V2).");
  process.exit(1);
}
console.log(`ETL target host: ${TARGET.replace(/^\w+:\/\/[^@]*@/, "//***@").split("/")[2] ?? "?"}`);

const prisma = new PrismaClient({ datasources: { db: { url: TARGET } } });
const dir = __dirname;

// Small concurrency helper — keeps a few thousand upserts reasonable over the wire.
async function inChunks<T>(items: T[], size: number, fn: (item: T) => Promise<unknown>): Promise<void> {
  for (let i = 0; i < items.length; i += size) {
    await Promise.all(items.slice(i, i + size).map(fn));
  }
}

async function main() {
  const dump = JSON.parse(readFileSync(join(dir, "../data-dump.json"), "utf8")) as V1Dump;
  const out = transform(dump);
  const cityId = out.orgNodes.find((n) => n.typeCanonicalKey === "city")!.id;

  // ── Prereqs from the seed catalog ──────────────────────────────────────────
  const globalRoot = await prisma.orgNode.findUnique({ where: { id: "org-global-root" } });
  if (!globalRoot) throw new Error("Target not seeded: global root missing. Run `npm run seed:v2` against ETL_TARGET_URL first.");

  // Per-city NodeType template (zone/sector/park/class) — mirrors ensureCityTemplate.
  const templateKeys = ["zone", "sector", "park", "class"];
  const canonicalTypes = await prisma.canonicalNodeType.findMany({ where: { key: { in: [...templateKeys, "country", "city", "global-root"] } } });
  const canonByKey = new Map(canonicalTypes.map((c) => [c.key, c]));
  for (const key of templateKeys) {
    const c = canonByKey.get(key)!;
    await prisma.nodeType.upsert({
      where: { cityId_canonicalId: { cityId, canonicalId: c.id } },
      update: {},
      create: { cityId, canonicalId: c.id, label: c.label, rank: c.rank },
    });
  }
  // typeId resolver: national types for country/city; per-city for park/class.
  const nationalTypes = await prisma.nodeType.findMany({ where: { cityId: null } });
  const cityTypes = await prisma.nodeType.findMany({ where: { cityId } });
  const typeIdFor = (key: string): string => {
    if (key === "country" || key === "city" || key === "global-root") {
      const c = canonByKey.get(key)!;
      const nt = nationalTypes.find((t) => t.canonicalId === c.id);
      if (!nt) throw new Error(`National NodeType missing for ${key}`);
      return nt.id;
    }
    const c = canonByKey.get(key)!;
    const nt = cityTypes.find((t) => t.canonicalId === c.id);
    if (!nt) throw new Error(`City NodeType missing for ${key}`);
    return nt.id;
  };

  // ── 1. OrgNodes (depth order so parents exist first) ───────────────────────
  const nodesByDepth = [...out.orgNodes].sort((a, b) => a.depth - b.depth);
  for (const n of nodesByDepth) {
    const data = { name: n.name, typeId: typeIdFor(n.typeCanonicalKey), parentId: n.parentId, path: n.path, depth: n.depth, countryId: n.countryId, cityId: n.cityId, legacyId: n.legacyId };
    await prisma.orgNode.upsert({ where: { id: n.id }, update: data, create: { id: n.id, ...data } });
  }
  console.log(`OrgNodes: ${out.orgNodes.length}`);

  // ── 2. Positions (per-city) + permission grants ────────────────────────────
  const canonPositions = await prisma.canonicalPosition.findMany();
  const canonPosByKey = new Map(canonPositions.map((c) => [c.key, c]));
  const allPerms = await prisma.permission.findMany();
  const permByKey = new Map(allPerms.map((p) => [p.key, p.id]));
  for (const pos of out.positions) {
    const canon = canonPosByKey.get(pos.canonicalKey);
    if (!canon) throw new Error(`CanonicalPosition missing for ${pos.canonicalKey}`);
    await prisma.position.upsert({
      where: { id: pos.id },
      update: { label: pos.label, rank: canon.rank },
      create: { id: pos.id, cityId: pos.cityId, canonicalId: canon.id, label: pos.label, rank: canon.rank, functionId: null },
    });
    for (const key of pos.permissionKeys) {
      const pid = permByKey.get(key);
      if (!pid) continue;
      await prisma.positionPermission.upsert({
        where: { positionId_permissionId: { positionId: pos.id, permissionId: pid } },
        update: {},
        create: { positionId: pos.id, permissionId: pid },
      });
    }
  }
  console.log(`Positions: ${out.positions.length}`);

  // ── 3. Persons ─────────────────────────────────────────────────────────────
  await inChunks(out.persons, 40, (p) =>
    prisma.person.upsert({
      where: { id: p.id },
      update: { name: p.name, phone: p.phone, email: p.email, status: p.status, cityId: p.cityId, legacyId: p.legacyId },
      create: { id: p.id, name: p.name, cnic: p.cnic, phone: p.phone, email: p.email, status: p.status, cityId: p.cityId, legacyId: p.legacyId },
    }),
  );
  console.log(`Persons: ${out.persons.length}`);

  // ── 4. Users (legacy email-login; temp password + mustChangePassword) ──────
  const creds: { email: string | null; tempPassword: string }[] = [];
  for (const u of out.users) {
    const existing = await prisma.user.findUnique({ where: { id: u.id } });
    if (existing) {
      await prisma.user.update({ where: { id: u.id }, data: { personId: u.personId, email: u.email, isActive: u.isActive } });
    } else {
      const tempPassword = randomBytes(9).toString("base64url");
      const passwordHash = await bcrypt.hash(tempPassword, 12);
      await prisma.user.create({ data: { id: u.id, personId: u.personId, email: u.email, passwordHash, mustChangePassword: true, isActive: u.isActive } });
      creds.push({ email: u.email, tempPassword });
    }
  }
  if (creds.length) {
    writeFileSync(join(dir, "credentials.local.json"), JSON.stringify(creds, null, 2));
    console.log(`Users: ${out.users.length} (wrote ${creds.length} temp credentials → prisma/etl/credentials.local.json)`);
  } else {
    console.log(`Users: ${out.users.length} (all existed — passwords unchanged)`);
  }

  // ── 5. Assignments ─────────────────────────────────────────────────────────
  await inChunks(out.assignments, 40, (a) =>
    prisma.assignment.upsert({
      where: { id: a.id },
      update: { orgNodeId: a.orgNodeId, positionId: a.positionId, cityId: a.cityId, endDate: null, legacyId: a.legacyId },
      create: { id: a.id, personId: a.personId, orgNodeId: a.orgNodeId, positionId: a.positionId, cityId: a.cityId, endDate: null, legacyId: a.legacyId },
    }),
  );
  console.log(`Assignments: ${out.assignments.length}`);

  // ── 6. Programs ────────────────────────────────────────────────────────────
  for (const p of out.programs) {
    await prisma.program.upsert({ where: { id: p.id }, update: { name: p.name }, create: { id: p.id, name: p.name, legacyId: p.legacyId } });
  }
  console.log(`Programs: ${out.programs.length}`);

  // ── 7. Events ──────────────────────────────────────────────────────────────
  await inChunks(out.events, 40, (e) =>
    prisma.event.upsert({
      where: { id: e.id },
      update: { title: e.title, orgNodeId: e.orgNodeId, rosterDepth: e.rosterDepth, programId: e.programId, status: e.status, scheduledAt: new Date(e.scheduledAt), recurring: e.recurring, cityId: e.cityId, legacyId: e.legacyId },
      create: { id: e.id, title: e.title, orgNodeId: e.orgNodeId, rosterDepth: e.rosterDepth, programId: e.programId, status: e.status, scheduledAt: new Date(e.scheduledAt), recurring: e.recurring, cityId: e.cityId, legacyId: e.legacyId },
    }),
  );
  console.log(`Events: ${out.events.length}`);

  // ── 8. Attendances ─────────────────────────────────────────────────────────
  await inChunks(out.attendances, 60, (a) =>
    prisma.attendance.upsert({
      where: { id: a.id },
      update: { status: a.status, markedById: a.markedById, legacyId: a.legacyId },
      create: { id: a.id, eventId: a.eventId, personId: a.personId, status: a.status, markedById: a.markedById, legacyId: a.legacyId },
    }),
  );
  console.log(`Attendances: ${out.attendances.length}`);

  console.log("\nLoad complete.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
