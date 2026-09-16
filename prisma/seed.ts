import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Cleaning existing database data...");
  await prisma.attendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.member.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.park.deleteMany();
  await prisma.city.deleteMany();

  console.log("Creating city and parks...");
  const city = await prisma.city.create({
    data: { name: "Islamabad" },
  });

  const park1 = await prisma.park.create({
    data: { name: "Fatima Jinnah Park (F-9)", cityId: city.id, capacity: 150 },
  });
  const park2 = await prisma.park.create({
    data: { name: "Lake View Park", cityId: city.id, capacity: 120 },
  });
  const park3 = await prisma.park.create({
    data: { name: "Japanese Park (F-6)", cityId: city.id, capacity: 80 },
  });
  const park4 = await prisma.park.create({
    data: { name: "Shakarparian Park", cityId: city.id, capacity: 100 },
  });

  console.log("Creating users...");
  const adminHash = await bcrypt.hash("admin123", 10);
  const teacherHash = await bcrypt.hash("teacher123", 10);

  const superAdmin = await prisma.user.create({
    data: {
      email: "admin@shababxit.com",
      passwordHash: adminHash,
      name: "System Admin",
      phone: "+923001234567",
      roles: "super_admin",
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: "hassain@shababxit.com",
      passwordHash: adminHash,
      name: "Hassain Sahib",
      phone: "+923002222222",
      roles: "admin",
    },
  });

  const teacherUser = await prisma.user.create({
    data: {
      email: "ali@shababxit.com",
      passwordHash: teacherHash,
      name: "Ali Khan",
      phone: "+923009876543",
      roles: "teacher",
    },
  });

  const zoneLeadsData = [
    { email: "zone1@shababxit.com", password: "zone1", name: "Ahtisham", park: park1 },
    { email: "zone2@shababxit.com", password: "zone2", name: "Sarmad Bilal", park: park2 },
    { email: "zone3@shababxit.com", password: "zone3", name: "Saeed", park: park3 },
    { email: "zone4@shababxit.com", password: "zone4", name: "Noman Ghafoor", park: park4 },
  ];

  const zoneLeadUsers = [];
  for (const zl of zoneLeadsData) {
    const hash = await bcrypt.hash(zl.password, 10);
    const u = await prisma.user.create({
      data: {
        email: zl.email,
        passwordHash: hash,
        name: zl.name,
        roles: "zone_lead",
      },
    });
    zoneLeadUsers.push({ user: u, park: zl.park, name: zl.name });
  }

  console.log("Creating member hierarchy...");
  const allMembers = [];

  for (const zl of zoneLeadUsers) {
    // Top-level zone lead member
    const zlMember = await prisma.member.create({
      data: {
        userId: zl.user.id,
        parkId: zl.park.id,
        name: zl.name,
        phone: "+92301" + Math.floor(1000000 + Math.random() * 9000000),
        positionLabel: "Zone Lead",
        canManageTeam: true,
        isTeaching: true,
        classAssignment: "Senior Halaqa",
      },
    });
    allMembers.push(zlMember);

    // Sub-team lead / teacher under zone lead
    const teacherMember = await prisma.member.create({
      data: {
        parentId: zlMember.id,
        parkId: zl.park.id,
        name: `Lead Teacher (${zl.park.name.split(" ")[0]})`,
        phone: "+92302" + Math.floor(1000000 + Math.random() * 9000000),
        positionLabel: "Teacher",
        canManageTeam: true,
        isTeaching: true,
        classAssignment: "Youth Circle",
      },
    });
    allMembers.push(teacherMember);

    // 4-5 students under each teacher
    const studentNames = ["Hamza", "Bilal", "Usman", "Zaid", "Omar", "Saad"];
    for (let i = 0; i < 4; i++) {
      const s = await prisma.member.create({
        data: {
          parentId: teacherMember.id,
          parkId: zl.park.id,
          name: `${studentNames[i]} (${zl.name.split(" ")[0]} Team)`,
          phone: "+92333" + Math.floor(1000000 + Math.random() * 9000000),
          positionLabel: "Student",
          canManageTeam: false,
          isTeaching: false,
          classAssignment: "Youth Circle",
        },
      });
      allMembers.push(s);
    }
  }

  // Link Ali Khan to one of the members
  const aliMember = await prisma.member.findFirst({ where: { positionLabel: "Teacher" } });
  if (aliMember) {
    await prisma.member.update({
      where: { id: aliMember.id },
      data: { userId: teacherUser.id, name: teacherUser.name },
    });
  }

  console.log("Creating events...");
  const events = [];
  const eventTypes = [
    { name: "Weekly Halaqa Session", type: "weekly_halaqa" },
    { name: "Morning Quran Study", type: "study_circle" },
    { name: "Youth Sports & Activity", type: "sports" },
    { name: "Mentorship Meetup", type: "mentorship" },
  ];

  const now = new Date();
  const parks = [park1, park2, park3, park4];

  for (let i = 0; i < 6; i++) {
    const eventDate = new Date(now.getTime() - (5 - i) * 7 * 24 * 60 * 60 * 1000);
    const selectedPark = parks[i % parks.length];
    const eventType = eventTypes[i % eventTypes.length];

    const ev = await prisma.event.create({
      data: {
        name: `${eventType.name} - Week ${i + 1}`,
        type: eventType.type,
        date: eventDate,
        startTime: "09:00 AM",
        endTime: "11:30 AM",
        parkId: selectedPark.id,
        status: i < 5 ? "completed" : "scheduled",
        isRecurring: true,
      },
    });
    events.push(ev);
  }

  console.log("Creating attendance records for completed events...");
  const statuses = ["present", "present", "present", "late", "absent", "excused"];

  for (const ev of events.filter(e => e.status === "completed")) {
    const parkMembers = allMembers.filter(m => m.parkId === ev.parkId);
    for (const member of parkMembers) {
      const randomStatus = statuses[Math.floor(Math.random() * statuses.length)];
      await prisma.attendance.create({
        data: {
          eventId: ev.id,
          memberId: member.id,
          status: randomStatus,
          markedById: superAdmin.id,
          overrideReason: randomStatus === "excused" ? "Family emergency" : null,
          createdAt: ev.date,
        },
      });
    }
  }

  console.log("Seed complete — dummy data successfully loaded.");
  console.log("Login credentials:");
  console.log("  Super Admin: admin@shababxit.com / admin123");
  console.log("  Admin:       hassain@shababxit.com / admin123");
  console.log("  Teacher:     ali@shababxit.com / teacher123");
  console.log("  Zone Lead:   zone1@shababxit.com / zone1");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
