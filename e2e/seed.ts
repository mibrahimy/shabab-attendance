// Seeds throwaway data for the Playwright suite and writes e2e/.fixtures.json.
// Requires the dev server running on :3000 and the v2 DB reachable. Idempotent-ish
// (uses a unique "E2E" country each run is not needed — teardown removes it first).
// NEVER touches the user's real rows (everything is under the "E2E" country).

import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { PrismaClient } from "../prisma/generated/v2-client";
import bcrypt from "bcryptjs";

const BASE = "http://localhost:3000";
const prisma = new PrismaClient();

const SA_CNIC = "11111-1111111-1";
const SA_PW = "TempPass!Aa1@2026";
const ADMIN_CNIC = "33333-3333333-3";
const ADMIN_PW = "AdminA!Pass2026#";
const MURABBI2_CNIC = "55555-5555555-5";
const MURABBI2_PW = "Murabbi2!Pass2026#";

// Minimal cookie jar over fetch (login/refresh set the session cookie).
function session() {
  const jar = new Map<string, string>();
  return async (path: string, init: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = { ...(init.headers as Record<string, string>) };
    if (init.body) headers["Content-Type"] = "application/json";
    if (jar.size) headers["Cookie"] = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
    const res = await fetch(BASE + path, { ...init, headers });
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(";");
      const i = pair.indexOf("=");
      if (i > 0) jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
    return res;
  };
}
const j = async <T>(res: Response): Promise<T> => (await res.json()) as T;

async function ensureSA() {
  const hash = await bcrypt.hash(SA_PW, 12);
  const root = await prisma.orgNode.findFirst({ where: { parentId: null }, select: { id: true } });
  const sa = await prisma.person.upsert({
    where: { id: "person-smoke-sa" },
    update: { status: "active", cnic: SA_CNIC },
    create: { id: "person-smoke-sa", name: "Smoke SA", cnic: SA_CNIC, status: "active" },
  });
  await prisma.user.upsert({
    where: { id: "user-smoke-sa" },
    update: { passwordHash: hash, mustChangePassword: false, isActive: true, tokenVersion: 0 },
    create: { id: "user-smoke-sa", personId: sa.id, passwordHash: hash, mustChangePassword: false },
  });
  await prisma.assignment.upsert({
    where: { id: "asgn-smoke-sa" },
    update: { endDate: null },
    create: { id: "asgn-smoke-sa", personId: sa.id, orgNodeId: root!.id, positionId: "pos-superadmin" },
  });
}

async function main() {
  await ensureSA();

  // Superadmin creates the country + city + inline admin.
  const sa = session();
  await sa("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: SA_CNIC, password: SA_PW }) });
  const country = await j<{ data: { country: { id: string } } }>(
    await sa("/api/countries", { method: "POST", body: JSON.stringify({ name: "E2E Country" }) }),
  );
  const cityRes = await j<{ data: { city: { id: string }; admin: { tempPassword: string } } }>(
    await sa("/api/cities", {
      method: "POST",
      body: JSON.stringify({ countryId: country.data.country.id, name: "E2E City", admin: { name: "E2E Admin", cnic: ADMIN_CNIC } }),
    }),
  );
  const tempPw = cityRes.data.admin.tempPassword;
  const cityId = cityRes.data.city.id;

  // Admin logs in, changes password, builds the tree.
  const admin = session();
  await admin("/api/auth/login", { method: "POST", body: JSON.stringify({ identifier: ADMIN_CNIC, password: tempPw }) });
  await admin("/api/auth/change-password", { method: "POST", body: JSON.stringify({ currentPassword: tempPw, newPassword: ADMIN_PW }) });

  const node = async (parentId: string, name: string) =>
    (await j<{ data: { node: { id: string } } }>(await admin("/api/org-nodes", { method: "POST", body: JSON.stringify({ parentId, name }) }))).data.node.id;
  const zone = await node(cityId, "Zone 1");
  const sector = await node(zone, "Sector A");
  const park = await node(sector, "Park 3");
  const classA = await node(park, "Class A");
  const classB = await node(park, "Class B");

  // 20 students in Class A (concurrent — independent, position-create is race-safe).
  await Promise.all(
    Array.from({ length: 20 }, (_, i) =>
      admin(`/api/org-nodes/${classA}/members`, {
        method: "POST",
        body: JSON.stringify({ roleKey: "student", person: { name: `Student ${String(i + 1).padStart(2, "0")}`, segment: "junior" } }),
      }),
    ),
  );
  // A murabbi in Class B (for the scope test).
  await admin(`/api/org-nodes/${classB}/members`, {
    method: "POST",
    body: JSON.stringify({ roleKey: "murabbi", person: { name: "Other Murabbi", cnic: MURABBI2_CNIC } }),
  });

  const now = new Date().toISOString();
  const evId = async (title: string) =>
    (await j<{ data: { id: string } }>(await admin("/api/events", { method: "POST", body: JSON.stringify({ nodeId: classA, title, scheduledAt: now }) }))).data.id;
  const eventId = await evId("Class A");
  const cancelledEventId = await evId("Cancelled Session");

  // Cancel the second event + set murabbi2 to a known password (DB — the app has no
  // event-cancel endpoint yet, and murabbi2 was created with a temp password).
  await prisma.event.update({ where: { id: cancelledEventId }, data: { status: "cancelled" } });
  const m2 = await prisma.person.findFirst({ where: { cnic: MURABBI2_CNIC }, select: { id: true } });
  await prisma.user.update({ where: { personId: m2!.id }, data: { passwordHash: await bcrypt.hash(MURABBI2_PW, 12), mustChangePassword: false } });

  writeFileSync(
    join(__dirname, ".fixtures.json"),
    JSON.stringify({
      admin: { cnic: ADMIN_CNIC, password: ADMIN_PW },
      murabbi2: { cnic: MURABBI2_CNIC, password: MURABBI2_PW },
      eventId,
      cancelledEventId,
      studentCount: 20,
    }),
  );
  console.log("E2E_SEEDED event", eventId, "cancelled", cancelledEventId);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("SEED_FAIL", e);
  await prisma.$disconnect();
  process.exit(1);
});
