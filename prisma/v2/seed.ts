// v2 seed — bootstraps the ONLY account created outside the app (the first
// superadmin) plus the minimal global catalog the app needs to start.
//
// Idempotent: every row uses a deterministic id / unique key and is upserted, so
// re-running makes no duplicates. Reads the superadmin's CNIC + password from env
// (SEED_SUPERADMIN_CNIC / _PASSWORD / _NAME).
//
// Run with: npm run seed:v2

import { PrismaClient } from "../generated/v2-client";
import bcrypt from "bcryptjs";
import { formatCnic } from "../../src/lib/cnic";

const prisma = new PrismaClient();

// ── Global catalog (managed reference data) ─────────────────────────────────

const canonicalNodeTypes = [
  { id: "cnt-global-root", key: "global-root", label: "Global Root", rank: 0 },
  { id: "cnt-country", key: "country", label: "Country", rank: 1 },
  { id: "cnt-city", key: "city", label: "City", rank: 2 },
  { id: "cnt-zone", key: "zone", label: "Zone", rank: 3 },
  { id: "cnt-sector", key: "sector", label: "Sector", rank: 4 },
  { id: "cnt-park", key: "park", label: "Park", rank: 5 },
  { id: "cnt-class", key: "class", label: "Class", rank: 6 },
];

const canonicalPositions = [
  { id: "cpos-superadmin", key: "superadmin", label: "Super Admin", rank: 0 },
  { id: "cpos-country-lead", key: "country_lead", label: "Country Lead", rank: 1 },
  { id: "cpos-city-admin", key: "city_admin", label: "City Admin", rank: 2 },
  { id: "cpos-zone-lead", key: "zone_lead", label: "Zone Lead", rank: 3 },
  { id: "cpos-sector-lead", key: "sector_lead", label: "Sector Lead", rank: 4 },
  { id: "cpos-park-admin", key: "park_admin", label: "Park Admin", rank: 5 },
  { id: "cpos-murabbi", key: "murabbi", label: "Murabbi", rank: 6 },
  { id: "cpos-student", key: "student", label: "Student", rank: 7 },
  { id: "cpos-city-poc", key: "city_poc", label: "City POC", rank: 8 },
];

const functions = [
  { id: "fn-sports", key: "sports", label: "Sports" },
  { id: "fn-tarbiya", key: "tarbiya", label: "Tarbiya" },
  { id: "fn-skills", key: "skills", label: "Skills" },
  { id: "fn-inventory", key: "inventory", label: "Inventory" },
];

// Starter permission set — enough for the superadmin to operate; the full
// catalog is a known open item (DEVELOPMENT.md). The superadmin gets all of them.
const permissions = [
  { id: "perm-manage-hierarchy", key: "manage_hierarchy", label: "Manage hierarchy" },
  { id: "perm-add-member", key: "add_member", label: "Add member" },
  { id: "perm-approve-member", key: "approve_member", label: "Approve member" },
  { id: "perm-create-event", key: "create_event", label: "Create event" },
  { id: "perm-mark-attendance", key: "mark_attendance", label: "Mark attendance" },
  { id: "perm-view-attendance", key: "view_attendance", label: "View attendance" },
  { id: "perm-manage-city", key: "manage_city", label: "Manage city" },
];

// National-level NodeTypes (cityId null) for the levels that sit above any city.
const nationalNodeTypes = [
  { id: "nt-global-root", canonicalId: "cnt-global-root", label: "Global Root", rank: 0 },
  { id: "nt-country", canonicalId: "cnt-country", label: "Country", rank: 1 },
  { id: "nt-city", canonicalId: "cnt-city", label: "City", rank: 2 },
];

const GLOBAL_ROOT_NODE_ID = "org-global-root";
const SUPERADMIN_POSITION_ID = "pos-superadmin";

async function main() {
  const cnic = formatCnic(requireEnv("SEED_SUPERADMIN_CNIC"));
  const password = requireEnv("SEED_SUPERADMIN_PASSWORD");
  const name = process.env.SEED_SUPERADMIN_NAME?.trim() || "Super Admin";

  // 1. Catalog — upsert by stable id.
  for (const c of canonicalNodeTypes) {
    await prisma.canonicalNodeType.upsert({
      where: { id: c.id },
      update: { key: c.key, label: c.label, rank: c.rank },
      create: c,
    });
  }
  for (const c of canonicalPositions) {
    await prisma.canonicalPosition.upsert({
      where: { id: c.id },
      update: { key: c.key, label: c.label, rank: c.rank },
      create: c,
    });
  }
  for (const f of functions) {
    await prisma.function.upsert({
      where: { id: f.id },
      update: { key: f.key, label: f.label },
      create: f,
    });
  }
  for (const p of permissions) {
    await prisma.permission.upsert({
      where: { id: p.id },
      update: { key: p.key, label: p.label },
      create: p,
    });
  }
  for (const nt of nationalNodeTypes) {
    await prisma.nodeType.upsert({
      where: { id: nt.id },
      update: { canonicalId: nt.canonicalId, label: nt.label, rank: nt.rank, cityId: null },
      create: { ...nt, cityId: null },
    });
  }

  // 2. National superadmin Position (cityId null, cross-functional) + all grants.
  await prisma.position.upsert({
    where: { id: SUPERADMIN_POSITION_ID },
    update: { canonicalId: "cpos-superadmin", label: "Super Admin", rank: 0, cityId: null, functionId: null },
    create: {
      id: SUPERADMIN_POSITION_ID,
      canonicalId: "cpos-superadmin",
      label: "Super Admin",
      rank: 0,
      cityId: null,
      functionId: null,
    },
  });
  for (const p of permissions) {
    await prisma.positionPermission.upsert({
      where: {
        positionId_permissionId: { positionId: SUPERADMIN_POSITION_ID, permissionId: p.id },
      },
      update: {},
      create: { positionId: SUPERADMIN_POSITION_ID, permissionId: p.id },
    });
  }

  // 3. Global root OrgNode (path is trailing-delimited; root depth 0).
  await prisma.orgNode.upsert({
    where: { id: GLOBAL_ROOT_NODE_ID },
    update: { name: "Global", typeId: "nt-global-root" },
    create: {
      id: GLOBAL_ROOT_NODE_ID,
      name: "Global",
      typeId: "nt-global-root",
      path: `/${GLOBAL_ROOT_NODE_ID}/`,
      depth: 0,
      parentId: null,
      countryId: null,
      cityId: null,
    },
  });

  // 4. Superadmin Person + User + Assignment @ global root.
  const passwordHash = await bcrypt.hash(password, 12);

  const person = await prisma.person.upsert({
    where: { id: "person-superadmin" },
    update: { name, cnic, status: "active" },
    create: {
      id: "person-superadmin",
      name,
      cnic,
      status: "active",
      cityId: null,
    },
  });

  await prisma.user.upsert({
    where: { id: "user-superadmin" },
    // Keep an existing password if the account already exists (don't reset on
    // every seed run); only (re)set it on first creation.
    update: { personId: person.id, isActive: true },
    create: {
      id: "user-superadmin",
      personId: person.id,
      passwordHash,
      mustChangePassword: true,
      isActive: true,
    },
  });

  await prisma.assignment.upsert({
    where: { id: "asgn-superadmin-root" },
    update: { personId: person.id, orgNodeId: GLOBAL_ROOT_NODE_ID, positionId: SUPERADMIN_POSITION_ID, endDate: null },
    create: {
      id: "asgn-superadmin-root",
      personId: person.id,
      orgNodeId: GLOBAL_ROOT_NODE_ID,
      positionId: SUPERADMIN_POSITION_ID,
      cityId: null,
      endDate: null,
    },
  });

  console.log(
    `Seeded v2: global root OrgNode + superadmin (login CNIC: ${cnic}) with ${permissions.length} permissions.`,
  );
}

function requireEnv(key: string): string {
  const value = process.env[key]?.trim();
  if (!value) {
    throw new Error(`Missing required env var ${key} (set it in .env before seeding).`);
  }
  return value;
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
