// Phase 3: insert the real Zone tier for Islamabad. The v1→v2 migration flattened
// zones into a park-name prefix ("Zone 1 - Park 1"). This creates the 7 zone
// OrgNodes, re-parents each park under its zone (cascading class path/depth), renames
// parks to the suffix ("Park 1"), assigns each zone's lead (the root Masool, by
// legacyId) as zone_lead, and retires the unused sector level.
//
// Idempotent. Dry-run first:
//   npx tsx --tsconfig tsconfig.json prisma/migrate-insert-zones.ts --dry-run
// Real run:
//   npx tsx --tsconfig tsconfig.json prisma/migrate-insert-zones.ts

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "./generated/v2-client";

const DRY = process.argv.includes("--dry-run");
const CITY_ID = "org-city-cmm5a5zfw000aiwvij5xv75tj";

// park legacyId (v1 UUID) → zone lead's person legacyId (the root Masool). This
// mapping is real people's identifiers — personal data — so it lives in a
// gitignored local file (prisma/zone-leads.local.json) and never lands in the repo.
// The migration already ran; a re-run needs that file present.
const ZONE_LEAD_BY_PARK: Record<string, string> = JSON.parse(
  readFileSync(join(process.cwd(), "prisma", "zone-leads.local.json"), "utf8"),
);

const ZONE_LEAD_PERMS = ["manage_hierarchy", "add_member", "create_event", "mark_attendance", "view_attendance"];

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_V2 } } });

const buildChildPath = (parentPath: string, id: string) => `${parentPath}${id}/`;

async function main() {
  const city = await db.orgNode.findUnique({ where: { id: CITY_ID } });
  if (!city) throw new Error(`City ${CITY_ID} not found`);

  const zoneType = await db.nodeType.findFirst({ where: { cityId: CITY_ID, key: "zone" } });
  const parkType = await db.nodeType.findFirst({ where: { cityId: CITY_ID, key: "park" } });
  const sectorType = await db.nodeType.findFirst({ where: { cityId: CITY_ID, key: "sector" } });
  if (!zoneType || !parkType) throw new Error("zone/park NodeType missing for city");

  const parks = await db.orgNode.findMany({ where: { typeId: parkType.id } });

  // Baseline counts (must be invariant except +N zone-lead assignments).
  const before = {
    people: await db.person.count(),
    events: await db.event.count(),
    attendance: await db.attendance.count(),
    assignments: await db.assignment.count({ where: { endDate: null } }),
    zones: await db.orgNode.count({ where: { typeId: zoneType.id } }),
  };

  // Build the plan.
  type Step = { park: typeof parks[number]; zoneName: string; parkSuffix: string; leadLegacyId: string; leadName: string; leadPersonId: string };
  const plan: Step[] = [];
  let alreadyDone = 0;
  for (const park of parks) {
    if (park.parentId !== CITY_ID) { alreadyDone++; continue; } // already re-parented
    const legacy = park.legacyId;
    if (!legacy || !(legacy in ZONE_LEAD_BY_PARK)) throw new Error(`Park ${park.name} (${park.id}) has no zone-lead mapping (legacyId=${legacy})`);
    const [zoneName, ...rest] = park.name.split(" - ");
    const parkSuffix = rest.join(" - ") || "Park 1";
    const leadLegacyId = ZONE_LEAD_BY_PARK[legacy];
    const lead = await db.person.findFirst({ where: { legacyId: leadLegacyId }, select: { id: true, name: true } });
    if (!lead) throw new Error(`Zone lead person legacyId=${leadLegacyId} not found for ${zoneName}`);
    plan.push({ park, zoneName: zoneName.trim(), parkSuffix: parkSuffix.trim(), leadLegacyId, leadName: lead.name, leadPersonId: lead.id });
  }

  console.log(`City: ${city.name} (${CITY_ID})`);
  console.log(`Parks found: ${parks.length}; already re-parented: ${alreadyDone}; to process: ${plan.length}`);
  console.log(`Sector level to retire: ${sectorType ? sectorType.id : "none"}`);
  console.log("Plan:");
  for (const s of plan) {
    console.log(`  • create zone "${s.zoneName}" → move park "${s.park.name}" under it, rename → "${s.parkSuffix}", zone_lead = ${s.leadName}`);
  }
  console.log("Before counts:", JSON.stringify(before));

  if (DRY) {
    console.log("\n[dry-run] no writes performed.");
    return;
  }
  if (plan.length === 0) {
    console.log("\nNothing to do (already restructured).");
    return;
  }

  await db.$transaction(async (tx) => {
    // Per-city zone_lead position (idempotent).
    let zoneLeadPos = await tx.position.findFirst({ where: { cityId: CITY_ID, key: "zone_lead" }, select: { id: true } });
    if (!zoneLeadPos) {
      const canonical = await tx.canonicalPosition.findUnique({ where: { key: "zone_lead" }, select: { id: true, label: true, rank: true } });
      if (!canonical) throw new Error("canonical zone_lead missing — run the seed");
      const perms = await tx.permission.findMany({ where: { key: { in: ZONE_LEAD_PERMS } }, select: { id: true } });
      zoneLeadPos = await tx.position.create({
        data: {
          cityId: CITY_ID, canonicalId: canonical.id, key: "zone_lead", attachLevelKey: "zone",
          label: canonical.label, rank: canonical.rank, functionId: null,
          permissions: { create: perms.map((p) => ({ permissionId: p.id })) },
        },
        select: { id: true },
      });
    }

    for (const s of plan) {
      const zoneId = randomUUID();
      const zonePath = buildChildPath(city.path, zoneId);
      await tx.orgNode.create({
        data: {
          id: zoneId, name: s.zoneName, typeId: zoneType.id, parentId: CITY_ID,
          depth: city.depth + 1, path: zonePath, countryId: city.countryId, cityId: CITY_ID,
        },
      });
      // Re-parent the park (+ its class subtree) under the zone: rewrite path/depth.
      const oldPrefix = s.park.path;
      const newParkPath = buildChildPath(zonePath, s.park.id);
      const depthDelta = city.depth + 2 - s.park.depth; // zone.depth+1 - park.depth
      await tx.$executeRaw`
        UPDATE "OrgNode"
        SET "path" = ${newParkPath} || substring("path" from ${oldPrefix.length + 1}::int),
            "depth" = "depth" + ${depthDelta}::int,
            "updatedAt" = now()
        WHERE "path" LIKE ${oldPrefix + "%"}`;
      await tx.orgNode.update({ where: { id: s.park.id }, data: { parentId: zoneId, name: s.parkSuffix } });

      // Assign the zone lead (idempotent).
      const existing = await tx.assignment.findFirst({
        where: { personId: s.leadPersonId, positionId: zoneLeadPos.id, orgNodeId: zoneId, endDate: null },
        select: { id: true },
      });
      if (!existing) {
        await tx.assignment.create({
          data: { personId: s.leadPersonId, positionId: zoneLeadPos.id, orgNodeId: zoneId, cityId: CITY_ID },
        });
      }
    }

    // Retire the unused sector level (0 nodes).
    if (sectorType) {
      const sectorNodes = await tx.orgNode.count({ where: { typeId: sectorType.id } });
      if (sectorNodes === 0) await tx.nodeType.delete({ where: { id: sectorType.id } });
      else console.warn(`sector has ${sectorNodes} nodes — NOT deleting`);
    }
  }, { maxWait: 15000, timeout: 60000 });

  // Verify.
  const after = {
    people: await db.person.count(),
    events: await db.event.count(),
    attendance: await db.attendance.count(),
    assignments: await db.assignment.count({ where: { endDate: null } }),
    zones: await db.orgNode.count({ where: { typeId: zoneType.id } }),
  };
  console.log("\nAfter counts:", JSON.stringify(after));

  const problems: string[] = [];
  if (after.people !== before.people) problems.push(`people changed ${before.people}→${after.people}`);
  if (after.events !== before.events) problems.push(`events changed ${before.events}→${after.events}`);
  if (after.attendance !== before.attendance) problems.push(`attendance changed ${before.attendance}→${after.attendance}`);
  if (after.assignments !== before.assignments + plan.length) problems.push(`assignments expected +${plan.length}, got ${before.assignments}→${after.assignments}`);
  if (after.zones !== before.zones + plan.length) problems.push(`zones expected +${plan.length}, got ${before.zones}→${after.zones}`);

  // Path integrity: every non-root node's path = parent.path + id + "/".
  const nodes = await db.orgNode.findMany({ select: { id: true, path: true, parentId: true, depth: true } });
  const byId = new Map(nodes.map((n) => [n.id, n]));
  for (const n of nodes) {
    if (!n.parentId) continue;
    const p = byId.get(n.parentId);
    if (!p) continue;
    if (n.path !== `${p.path}${n.id}/`) problems.push(`path mismatch at ${n.id}`);
    if (n.depth !== p.depth + 1) problems.push(`depth mismatch at ${n.id}`);
  }
  // Each new zone has a lead.
  for (const s of plan) {
    const zone = await db.orgNode.findFirst({ where: { parentId: CITY_ID, name: s.zoneName, typeId: zoneType.id }, select: { id: true } });
    if (!zone) { problems.push(`zone ${s.zoneName} missing`); continue; }
    const lead = await db.assignment.count({ where: { orgNodeId: zone.id, endDate: null, position: { key: "zone_lead" } } });
    if (lead < 1) problems.push(`zone ${s.zoneName} has no lead`);
  }

  if (problems.length) {
    console.error("VERIFY FAILED:", problems.join("; "));
    process.exit(1);
  }
  console.log("VERIFY OK — zones inserted, parks re-parented, leads assigned, counts consistent, paths intact.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => db.$disconnect());
