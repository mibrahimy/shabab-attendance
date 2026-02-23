import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  // Clean existing data
  await prisma.attendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.member.deleteMany();
  await prisma.session.deleteMany();
  await prisma.user.deleteMany();
  await prisma.park.deleteMany();
  await prisma.city.deleteMany();

  // Create admin user
  const adminHash = await bcrypt.hash("admin123", 10);
  const admin = await prisma.user.create({
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
  const adminUser = await prisma.user.create({
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
  const teacher = await prisma.user.create({
    data: {
      email: "ali@shababxit.com",
      passwordHash: teacherHash,
      name: "Ali Khan",
      phone: "+923009876543",
      roles: "teacher",
    },
  });

  // Create city
  const islamabad = await prisma.city.create({
    data: { name: "Islamabad" },
  });

  // Create parks
  const parkG11 = await prisma.park.create({
    data: { name: "G-11 Park", cityId: islamabad.id, capacity: 80 },
  });

  const parkF9 = await prisma.park.create({
    data: { name: "F-9 Park", cityId: islamabad.id, capacity: 120 },
  });

  // Create team hierarchy
  const cityHead = await prisma.member.create({
    data: {
      name: "Islamabad Shabab Masool",
      phone: "+923001111111",
      positionLabel: "City Head",
      canManageTeam: true,
      parkId: parkG11.id,
      userId: admin.id,
    },
  });

  const zonalLead = await prisma.member.create({
    data: {
      name: "Hassain Sahib",
      phone: "+923002222222",
      positionLabel: "Zonal Lead",
      canManageTeam: true,
      parentId: cityHead.id,
      parkId: parkG11.id,
      userId: adminUser.id,
    },
  });

  const aliMember = await prisma.member.create({
    data: {
      name: "Ali Khan",
      phone: "+923009876543",
      positionLabel: "Teacher",
      isTeaching: true,
      classAssignment: "Grade 5A",
      parentId: zonalLead.id,
      parkId: parkG11.id,
      userId: teacher.id,
    },
  });

  const sara = await prisma.member.create({
    data: {
      name: "Sara Malik",
      phone: "+923003333333",
      positionLabel: "Teacher",
      isTeaching: true,
      classAssignment: "Grade 5B",
      canManageTeam: true,
      parentId: zonalLead.id,
      parkId: parkG11.id,
    },
  });

  await prisma.member.create({
    data: {
      name: "Usman Ahmed",
      phone: "+923004444444",
      positionLabel: "Member",
      parentId: sara.id,
      parkId: parkG11.id,
    },
  });

  const zonalLead2 = await prisma.member.create({
    data: {
      name: "Zeama Jaikson",
      phone: "+923005555555",
      positionLabel: "Zonal Lead",
      canManageTeam: true,
      parentId: cityHead.id,
      parkId: parkF9.id,
    },
  });

  const fahad = await prisma.member.create({
    data: {
      name: "Fahad Ahmed",
      phone: "+923006666666",
      positionLabel: "Teacher",
      isTeaching: true,
      classAssignment: "Grade 4A",
      parentId: zonalLead2.id,
      parkId: parkF9.id,
    },
  });

  await prisma.member.create({
    data: {
      name: "Bilal Hassan",
      phone: "+923007777777",
      positionLabel: "Member",
      parentId: zonalLead2.id,
      parkId: parkF9.id,
    },
  });

  await prisma.member.create({
    data: {
      name: "Hamza Iqbal",
      phone: "+923008888888",
      positionLabel: "Teacher",
      isTeaching: true,
      classAssignment: "Grade 3A",
      parentId: zonalLead2.id,
      parkId: parkF9.id,
    },
  });

  // Create events
  const today = new Date();
  const nextSunday = new Date(today);
  nextSunday.setDate(today.getDate() + (7 - today.getDay()));

  const events = await Promise.all([
    prisma.event.create({
      data: {
        name: "Grade 5A Weekly Class",
        type: "weekly_session",
        date: nextSunday,
        startTime: "09:00",
        endTime: "11:00",
        parkId: parkG11.id,
        isRecurring: true,
      },
    }),
    prisma.event.create({
      data: {
        name: "Grade 5B Weekly Class",
        type: "weekly_session",
        date: nextSunday,
        startTime: "09:00",
        endTime: "11:00",
        parkId: parkG11.id,
        isRecurring: true,
      },
    }),
    prisma.event.create({
      data: {
        name: "New Student Orientation",
        type: "orientation",
        date: new Date(nextSunday.getTime() + 7 * 24 * 60 * 60 * 1000),
        startTime: "10:00",
        endTime: "12:00",
        parkId: parkG11.id,
      },
    }),
    prisma.event.create({
      data: {
        name: "Team Mashwara",
        type: "mashwara",
        date: new Date(today.getTime() - 3 * 24 * 60 * 60 * 1000),
        startTime: "14:00",
        endTime: "15:30",
        parkId: parkG11.id,
        status: "completed",
      },
    }),
    prisma.event.create({
      data: {
        name: "Grade 4A Weekly Class",
        type: "weekly_session",
        date: nextSunday,
        startTime: "09:00",
        endTime: "11:00",
        parkId: parkF9.id,
        isRecurring: true,
      },
    }),
  ]);

  // Create some attendance records for the completed mashwara
  const mashwara = events[3];
  const membersForAttendance = [aliMember, sara, zonalLead];

  for (const member of membersForAttendance) {
    await prisma.attendance.create({
      data: {
        eventId: mashwara.id,
        memberId: member.id,
        status: "present",
        markedById: admin.id,
      },
    });
  }

  // Add some absent records too
  await prisma.attendance.create({
    data: {
      eventId: mashwara.id,
      memberId: fahad.id,
      status: "absent",
      markedById: admin.id,
    },
  });

  console.log("Seed data created successfully!");
  console.log("Login credentials:");
  console.log("  Super Admin: admin@shababxit.com / admin123");
  console.log("  Admin: hassain@shababxit.com / admin123");
  console.log("  Teacher: ali@shababxit.com / teacher123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
