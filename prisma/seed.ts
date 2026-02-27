import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean everything — full reset
  await prisma.attendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.member.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.park.deleteMany();
  await prisma.city.deleteMany();

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@shababxit.com",
      passwordHash: adminHash,
      name: "System Admin",
      phone: "+923001234567",
      roles: "super_admin",
    },
  });

  // Create an admin user
  const adminUserHash = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "hassain@shababxit.com",
      passwordHash: adminUserHash,
      name: "Hassain Sahib",
      phone: "+923002222222",
      roles: "admin",
    },
  });

  // Create a teacher user
  const teacherHash = await bcrypt.hash("teacher123", 10);
  await prisma.user.create({
    data: {
      email: "ali@shababxit.com",
      passwordHash: teacherHash,
      name: "Ali Khan",
      phone: "+923009876543",
      roles: "teacher",
    },
  });

  // Create zone lead accounts
  const zoneLeads = [
    { email: "zone1@shababxit.com", password: "zone1", name: "Ahtisham" },
    { email: "zone2@shababxit.com", password: "zone2", name: "Sarmad Bilal" },
    { email: "zone3@shababxit.com", password: "zone3", name: "Saeed" },
    { email: "zone4@shababxit.com", password: "zone4", name: "Noman Ghafoor" },
    { email: "zone5@shababxit.com", password: "zone5", name: "Ansar Iqbal" },
    { email: "zone6@shababxit.com", password: "zone6", name: "Adeel Haider" },
    { email: "zone7@shababxit.com", password: "zone7", name: "Sardar Faisal" },
  ];

  for (const zl of zoneLeads) {
    const hash = await bcrypt.hash(zl.password, 10);
    await prisma.user.create({
      data: {
        email: zl.email,
        passwordHash: hash,
        name: zl.name,
        roles: "zone_lead",
      },
    });
  }

  // Create city (Excel import depends on this)
  await prisma.city.create({
    data: { name: "Islamabad" },
  });

  console.log("Seed complete — users + city created.");
  console.log("Login credentials:");
  console.log("  Super Admin: admin@shababxit.com / admin123");
  console.log("  Admin:       hassain@shababxit.com / admin123");
  console.log("  Teacher:     ali@shababxit.com / teacher123");
  for (const zl of zoneLeads) {
    console.log(`  Zone Lead:   ${zl.email} / ${zl.password}  (${zl.name})`);
  }
  console.log("\nRun the Excel import next: npx tsx --tsconfig tsconfig.json prisma/import-excel.ts");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
