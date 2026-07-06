// Removes the Playwright throwaway data (everything under the "E2E" country) + the
// smoke superadmin. Never touches the user's real rows.

import { rmSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../prisma/generated/v2-client";

const prisma = new PrismaClient();

async function main() {
  const country = await prisma.orgNode.findFirst({ where: { name: "E2E Country" }, select: { path: true } });
  const nodes = country
    ? await prisma.orgNode.findMany({ where: { path: { startsWith: country.path } }, select: { id: true, cityId: true, depth: true } })
    : [];
  const ids = nodes.map((n) => n.id);
  const cityIds = [...new Set(nodes.map((n) => n.cityId).filter(Boolean) as string[])];
  const events = await prisma.event.findMany({ where: { orgNodeId: { in: ids } }, select: { id: true } });
  const evIds = events.map((e) => e.id);
  const persons = await prisma.person.findMany({
    where: { OR: [{ cnic: { in: ["11111-1111111-1", "33333-3333333-3", "55555-5555555-5"] } }, { cityId: { in: cityIds } }] },
    select: { id: true },
  });
  const pids = persons.map((x) => x.id);

  await prisma.attendance.deleteMany({ where: { eventId: { in: evIds } } });
  await prisma.event.deleteMany({ where: { id: { in: evIds } } });
  await prisma.auditLog.deleteMany({ where: { OR: [{ actorPersonId: { in: pids } }, { cityId: { in: cityIds } }, { targetId: { in: [...ids, ...pids, ...evIds] } }] } });
  await prisma.assignment.deleteMany({ where: { OR: [{ personId: { in: pids } }, { orgNodeId: { in: ids } }] } });
  await prisma.user.deleteMany({ where: { personId: { in: pids } } });
  await prisma.person.deleteMany({ where: { id: { in: pids } } });
  for (let d = 6; d >= 1; d--) await prisma.orgNode.deleteMany({ where: { id: { in: ids }, depth: d } });
  await prisma.nodeType.deleteMany({ where: { cityId: { in: cityIds } } });
  await prisma.position.deleteMany({ where: { cityId: { in: cityIds } } });
  // smoke SA
  await prisma.assignment.deleteMany({ where: { id: "asgn-smoke-sa" } });
  await prisma.user.deleteMany({ where: { id: "user-smoke-sa" } });
  await prisma.person.deleteMany({ where: { id: "person-smoke-sa" } });

  try { rmSync(join(__dirname, ".fixtures.json")); } catch { /* ok */ }
  const left = await prisma.orgNode.count({ where: { name: { startsWith: "E2E " } } });
  console.log("E2E_TORNDOWN leftover:", left, "persons:", await prisma.person.count());
  await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
