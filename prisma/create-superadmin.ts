// Create a new superadmin: a Person + login User + Assignment at the global root
// with the national superadmin Position. The temp password is printed ONCE (stored
// hashed; mustChangePassword = true).
//
//   npx tsx --tsconfig tsconfig.json prisma/create-superadmin.ts "Full Name" 12345-1234567-1

import bcrypt from "bcryptjs";
import { PrismaClient } from "./generated/v2-client";
import { formatCnic } from "../src/lib/cnic";
import { generateTempPassword } from "../src/lib/password-generate";

const GLOBAL_ROOT_NODE_ID = "org-global-root";
const SUPERADMIN_POSITION_ID = "pos-superadmin";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_V2 } } });

async function main() {
  const name = (process.argv[2] ?? "").trim();
  const rawCnic = (process.argv[3] ?? "").trim();
  if (!name || !rawCnic) throw new Error('Usage: create-superadmin.ts "Full Name" <CNIC>');
  const cnic = formatCnic(rawCnic);

  // Guards.
  const [root, position, existing] = await Promise.all([
    db.orgNode.findUnique({ where: { id: GLOBAL_ROOT_NODE_ID }, select: { id: true } }),
    db.position.findUnique({ where: { id: SUPERADMIN_POSITION_ID }, select: { id: true, label: true } }),
    db.person.findFirst({ where: { cnic }, select: { id: true, name: true } }),
  ]);
  if (!root) throw new Error("Global root OrgNode missing — run the seed first");
  if (!position) throw new Error("Superadmin Position missing — run the seed first");
  if (existing) throw new Error(`A person with CNIC ${cnic} already exists (${existing.name}) — aborting`);

  const password = generateTempPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  const { personId, userId } = await db.$transaction(async (tx) => {
    const person = await tx.person.create({
      data: { name, cnic, status: "active", cityId: null },
      select: { id: true },
    });
    const user = await tx.user.create({
      data: { personId: person.id, passwordHash, mustChangePassword: true, isActive: true },
      select: { id: true },
    });
    await tx.assignment.create({
      data: {
        personId: person.id,
        orgNodeId: GLOBAL_ROOT_NODE_ID,
        positionId: SUPERADMIN_POSITION_ID,
        cityId: null,
        endDate: null,
      },
    });
    return { personId: person.id, userId: user.id };
  });

  console.log("\n✅ Superadmin created.");
  console.log("─".repeat(48));
  console.log(`  Name:      ${name}`);
  console.log(`  Login CNIC: ${cnic}`);
  console.log(`  Temp password (shown ONCE): ${password}`);
  console.log("─".repeat(48));
  console.log(`  personId: ${personId}  userId: ${userId}`);
  console.log("  Stored hashed · must be changed on first login.\n");
}

main()
  .catch((e) => { console.error("ERROR:", e.message); process.exit(1); })
  .finally(() => db.$disconnect());
