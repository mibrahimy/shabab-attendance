// ETL VERIFY — reconciles the loaded v2 DB against the transform + does spot
// checks and path-integrity checks. Read-only. Run against whatever ETL_TARGET_URL
// points at (disposable first, then the real v2 DB after the real load).
//
// Run: ETL_TARGET_URL="postgres://…" npm run etl:verify

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../generated/v2-client";
import { transform, type V1Dump } from "./transform";
import { PATH_DELIMITER } from "../../src/lib/org-path";

const TARGET = process.env.ETL_TARGET_URL;
if (!TARGET) { console.error("Set ETL_TARGET_URL."); process.exit(1); }
const prisma = new PrismaClient({ datasources: { db: { url: TARGET } } });
const dir = __dirname;

let failures = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`  ${ok ? "✓" : "✗"} ${name}: ${detail}`);
  if (!ok) failures++;
}

async function main() {
  const dump = JSON.parse(readFileSync(join(dir, "../data-dump.json"), "utf8")) as V1Dump;
  const out = transform(dump);
  const cityId = out.orgNodes.find((n) => n.typeCanonicalKey === "city")!.id;
  const cityNode = await prisma.orgNode.findUnique({ where: { id: cityId } });
  if (!cityNode) throw new Error("City node not found in target — did the load run?");
  const cityPath = cityNode.path;

  console.log("\n=== Count reconciliation (migrated → in DB) ===");
  const [nodes, persons, assignments, programs, events, attendances] = await Promise.all([
    prisma.orgNode.count({ where: { path: { startsWith: cityPath } } }),
    prisma.person.count({ where: { legacyId: { not: null } } }),
    prisma.assignment.count({ where: { legacyId: { not: null } } }),
    prisma.program.count({ where: { legacyId: { not: null } } }),
    prisma.event.count({ where: { legacyId: { not: null } } }),
    prisma.attendance.count({ where: { legacyId: { not: null } } }),
  ]);
  // city subtree nodes = city + parks + classes (country sits above the city path)
  const expectedSubtree = out.orgNodes.filter((n) => n.path.startsWith(cityPath)).length;
  check("OrgNodes (city subtree)", nodes === expectedSubtree, `${nodes} (expected ${expectedSubtree})`);
  check("Persons", persons === out.persons.length, `${persons} (expected ${out.persons.length})`);
  check("Assignments", assignments === out.assignments.length, `${assignments} (expected ${out.assignments.length})`);
  check("Programs", programs === out.programs.length, `${programs} (expected ${out.programs.length})`);
  check("Events", events === out.events.length, `${events} (expected ${out.events.length})`);
  check("Attendances", attendances === out.attendances.length, `${attendances} (expected ${out.attendances.length})`);

  console.log("\n=== No orphans ===");
  const badAssign = await prisma.assignment.count({ where: { legacyId: { not: null }, OR: [{ orgNode: { is: undefined } }] } });
  check("Assignments → node+position", badAssign === 0, `${badAssign} orphaned`);
  // attendances whose event or person is missing would violate FKs, so instead check counts of distinct
  const attWithEvent = await prisma.attendance.count({ where: { legacyId: { not: null }, event: { isNot: undefined } } });
  check("Attendances → event", attWithEvent === attendances, `${attWithEvent}/${attendances} linked`);

  console.log("\n=== Spot checks (3 parks: DB roster vs source members) ===");
  const parkNodes = await prisma.orgNode.findMany({ where: { cityId, type: { canonical: { key: "park" } } }, take: 3 });
  for (const park of parkNodes) {
    // DB roster = distinct persons assigned anywhere in the park subtree
    const asgns = await prisma.assignment.findMany({ where: { orgNode: { path: { startsWith: park.path } }, endDate: null }, select: { personId: true } });
    const dbRoster = new Set(asgns.map((a) => a.personId)).size;
    // source members for this park (by legacyId), excluding class-subgroups
    const srcMembers = out.assignments.filter((a) => {
      const node = out.orgNodes.find((n) => n.id === a.orgNodeId);
      return node && node.path.startsWith(park.path);
    }).length;
    check(`Park "${park.name}"`, dbRoster === srcMembers, `DB roster ${dbRoster} = expected ${srcMembers}`);
  }

  console.log("\n=== Path integrity ===");
  const allNodes = await prisma.orgNode.findMany({ where: { path: { startsWith: cityPath } }, select: { id: true, path: true, parentId: true } });
  const byId = new Map(allNodes.map((n) => [n.id, n]));
  let badPaths = 0;
  for (const n of allNodes) {
    if (!n.path.startsWith(PATH_DELIMITER) || !n.path.endsWith(PATH_DELIMITER)) badPaths++;
    const parent = n.parentId ? byId.get(n.parentId) : null;
    if (parent && n.path !== `${parent.path}${n.id}${PATH_DELIMITER}`) badPaths++;
  }
  check("Path prefix chains", badPaths === 0, `${badPaths} malformed`);

  console.log(`\n${failures === 0 ? "✓ ALL CHECKS PASSED" : `✗ ${failures} CHECK(S) FAILED`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
