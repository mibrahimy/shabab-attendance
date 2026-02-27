import { PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";

const prisma = new PrismaClient();
const EXCEL_PATH = "/home/mi/Desktop/shababxit/Roots Of Wisdom Attendance .xlsx";

// Excel serial 46046 = Jan 24, 2026 (Saturday) — confirmed by user
const BASE_SERIAL = 46046;
const BASE_DATE = new Date("2026-01-24T00:00:00Z");

function serialToDate(serial: number): Date {
  const dayOffset = serial - BASE_SERIAL;
  return new Date(BASE_DATE.getTime() + dayOffset * 86400 * 1000);
}

function normalizeStatus(raw: string): string | null {
  const val = raw.trim().toLowerCase();
  if (val === "present") return "present";
  if (val === "late") return "late";
  if (val === "absent") return "absent";
  if (val === "rukhsat" || val === "leave") return "excused";
  return null;
}

function isPhoneNumber(val: unknown): boolean {
  if (typeof val === "number") return val > 999999999; // 10+ digits
  if (typeof val === "string") {
    const digits = val.replace(/\D/g, "");
    return digits.length >= 10;
  }
  return false;
}

interface ZoneConfig {
  nameCol: number;
  numberCol: number;
  tashkeelCol: number;
  dateStartCol: number;
}

const STANDARD: ZoneConfig = { nameCol: 0, numberCol: 1, tashkeelCol: 2, dateStartCol: 3 };
// Zone 7: Name, [phone in col1], [area in col2], "", Tashkeel, dates...
const ZONE7: ZoneConfig = { nameCol: 0, numberCol: 1, tashkeelCol: 4, dateStartCol: 5 };

async function main() {
  // Clean existing parks/members/events/attendance so re-runs are safe
  console.log("Cleaning existing data (attendance, events, members, parks)...");
  await prisma.attendance.deleteMany();
  await prisma.event.deleteMany();
  await prisma.member.deleteMany();
  await prisma.park.deleteMany();

  const wb = XLSX.readFile(EXCEL_PATH);
  const zoneSheets = wb.SheetNames.filter((n) => n !== "Total Attnd");

  // Find existing Islamabad city (created by seed)
  let city = await prisma.city.findFirst({ where: { name: "Islamabad" } });
  if (!city) {
    city = await prisma.city.create({ data: { name: "Islamabad" } });
    console.log("Created Islamabad city");
  }

  let totalMembers = 0;
  let totalEvents = 0;
  let totalAttendance = 0;

  for (const sheetName of zoneSheets) {
    console.log(`\n=== ${sheetName} ===`);
    const data: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheetName], {
      header: 1,
      defval: "",
    });

    const isZone7 = sheetName.includes("Zone 7");
    const config = isZone7 ? ZONE7 : STANDARD;

    // --- Parse date columns from header row ---
    const headerRow = data[0] as unknown[];
    const dateColumns: { colIndex: number; date: Date; dayName: string }[] = [];
    for (let c = config.dateStartCol; c < headerRow.length; c++) {
      const val = headerRow[c];
      if (typeof val === "number" && val > 40000) {
        const date = serialToDate(val);
        const dayName = date.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
        dateColumns.push({ colIndex: c, date, dayName });
      }
    }
    console.log(`  ${dateColumns.length} date columns: ${dateColumns.map((d) => d.date.toISOString().slice(0, 10)).join(", ")}`);

    // --- Create park for this zone ---
    const zoneName = sheetName.trim();
    let park = await prisma.park.findFirst({ where: { name: zoneName, cityId: city.id } });
    if (!park) {
      park = await prisma.park.create({ data: { name: zoneName, cityId: city.id } });
    }

    // --- Create events per date ---
    const eventMap = new Map<string, string>(); // dateISO → eventId
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    for (const dc of dateColumns) {
      const dateStr = dc.date.toISOString().slice(0, 10);
      const eventName = `${dc.dayName} Session - ${zoneName}`;
      const status = dc.date <= today ? "completed" : "scheduled";

      let event = await prisma.event.findFirst({
        where: { name: eventName, date: dc.date, parkId: park.id },
      });
      if (!event) {
        event = await prisma.event.create({
          data: {
            name: eventName,
            type: "weekly_session",
            date: dc.date,
            startTime: "09:00",
            endTime: "11:00",
            parkId: park.id,
            status,
          },
        });
        totalEvents++;
      }
      eventMap.set(dateStr, event.id);
    }

    // --- First pass: find first Masool row to create zone lead ---
    let zoneLeadId: string | null = null;
    let zoneLeadRowIndex = -1;

    // Derive zone number from sheet name (e.g. "Zone 5 Asadullah" → 5)
    const zoneMatch = sheetName.match(/Zone\s+(\d+)/i);
    const zoneNumber = zoneMatch ? parseInt(zoneMatch[1]) : null;

    for (let r = 2; r < data.length; r++) {
      const row = data[r] as unknown[];
      const tashkeel = String(row[config.tashkeelCol] || "").trim().toLowerCase();
      const name = String(row[config.nameCol] || "").trim();
      if (name && tashkeel === "masool") {
        // Create zone lead
        let phone: string | null = null;
        if (isPhoneNumber(row[config.numberCol])) {
          phone = String(row[config.numberCol]);
        }

        // Link to User account by zone number
        let userId: string | undefined = undefined;
        if (zoneNumber) {
          const user = await prisma.user.findFirst({
            where: { email: `zone${zoneNumber}@shababxit.com` },
          });
          if (user) {
            userId = user.id;
            console.log(`  Linked to user: zone${zoneNumber}@shababxit.com`);
          }
        }

        let member = await prisma.member.findFirst({ where: { name, parkId: park.id } });
        if (!member) {
          member = await prisma.member.create({
            data: {
              name,
              phone,
              positionLabel: "Masool",
              canManageTeam: true,
              parkId: park.id,
              userId,
            },
          });
          totalMembers++;
        }
        zoneLeadId = member.id;
        zoneLeadRowIndex = r;
        console.log(`  Zone lead: ${name} (row ${r})`);

        // Create attendance for zone lead
        for (const dc of dateColumns) {
          const cellVal = String(row[dc.colIndex] || "").trim();
          if (!cellVal) continue;
          const status = normalizeStatus(cellVal);
          if (!status) continue;
          const dateStr = dc.date.toISOString().slice(0, 10);
          const eventId = eventMap.get(dateStr);
          if (!eventId) continue;
          await prisma.attendance.upsert({
            where: { eventId_memberId: { eventId, memberId: member.id } },
            update: { status },
            create: { eventId, memberId: member.id, status },
          });
          totalAttendance++;
        }
        break;
      }
    }

    if (!zoneLeadId) {
      console.log("  WARNING: No Masool found, skipping zone");
      continue;
    }

    // --- Second pass: process all rows ---
    let currentGroupId: string | null = null;

    for (let r = 2; r < data.length; r++) {
      if (r === zoneLeadRowIndex) continue; // already processed

      const row = data[r] as unknown[];
      const name = String(row[config.nameCol] || "").trim();
      const numberVal = row[config.numberCol];
      const tashkeel = String(row[config.tashkeelCol] || "").trim();

      // --- Handle empty-name rows (possible section markers) ---
      if (!name) {
        // Section marker in tashkeel column (e.g. Zone 5 row 23: "Shabab")
        if (tashkeel) {
          const group = await prisma.member.create({
            data: {
              name: tashkeel,
              positionLabel: "Sub-group",
              canManageTeam: true,
              parkId: park.id,
              parentId: zoneLeadId,
            },
          });
          currentGroupId = group.id;
          totalMembers++;
          console.log(`  Sub-group (tashkeel): ${tashkeel}`);
        }
        // Section marker in number column (e.g. Zone 5 row 18: "Ilm Deen")
        else if (numberVal && typeof numberVal === "string" && numberVal.trim() && !isPhoneNumber(numberVal)) {
          const label = numberVal.trim();
          const group = await prisma.member.create({
            data: {
              name: label,
              positionLabel: "Sub-group",
              canManageTeam: true,
              parkId: park.id,
              parentId: zoneLeadId,
            },
          });
          currentGroupId = group.id;
          totalMembers++;
          console.log(`  Sub-group (number col): ${label}`);
        }
        continue;
      }

      // --- Check if row has any attendance data ---
      const hasAttendance = dateColumns.some((dc) => {
        const cellVal = String(row[dc.colIndex] || "").trim();
        return cellVal !== "" && normalizeStatus(cellVal) !== null;
      });

      // --- Section header: has name but zero attendance ---
      if (!hasAttendance) {
        const nameLower = name.toLowerCase();

        // "expected" footer section in Zone 6 → stop processing this zone
        if (nameLower.includes("expected")) break;

        // Create sub-group
        const group = await prisma.member.create({
          data: {
            name,
            positionLabel: "Sub-group",
            canManageTeam: true,
            parkId: park.id,
            parentId: zoneLeadId,
          },
        });
        currentGroupId = group.id;
        totalMembers++;
        console.log(`  Sub-group: ${name}`);
        continue;
      }

      // --- Regular member row ---
      let phone: string | null = null;
      if (isPhoneNumber(numberVal)) {
        phone = String(numberVal);
      }

      const positionLabel = tashkeel || "Member";
      const parentId = currentGroupId || zoneLeadId;

      // Dedup by name + park
      let member = await prisma.member.findFirst({ where: { name, parkId: park.id } });
      if (!member) {
        member = await prisma.member.create({
          data: {
            name,
            phone,
            positionLabel,
            parkId: park.id,
            parentId,
            canManageTeam: positionLabel.toLowerCase() === "masool",
          },
        });
        totalMembers++;
      }

      // --- Create attendance records ---
      for (const dc of dateColumns) {
        const cellVal = String(row[dc.colIndex] || "").trim();
        if (!cellVal) continue;
        const status = normalizeStatus(cellVal);
        if (!status) continue;
        const dateStr = dc.date.toISOString().slice(0, 10);
        const eventId = eventMap.get(dateStr);
        if (!eventId) continue;

        await prisma.attendance.upsert({
          where: { eventId_memberId: { eventId, memberId: member.id } },
          update: { status },
          create: { eventId, memberId: member.id, status },
        });
        totalAttendance++;
      }
    }
  }

  // --- Create upcoming events (Feb 28 + March 1, 2026) for all parks ---
  console.log("\n=== Creating Upcoming Events ===");
  const upcomingDates = [
    { date: new Date("2026-02-28T00:00:00Z"), dayName: "Saturday" },
    { date: new Date("2026-03-01T00:00:00Z"), dayName: "Sunday" },
  ];

  const allParks = await prisma.park.findMany();
  let upcomingCreated = 0;

  for (const park of allParks) {
    for (const { date, dayName } of upcomingDates) {
      const eventName = `${dayName} Session - ${park.name}`;
      const existing = await prisma.event.findFirst({
        where: { name: eventName, date, parkId: park.id },
      });
      if (!existing) {
        await prisma.event.create({
          data: {
            name: eventName,
            type: "weekly_session",
            date,
            startTime: "09:00",
            endTime: "11:00",
            parkId: park.id,
            status: "scheduled",
          },
        });
        upcomingCreated++;
        console.log(`  Created: ${eventName} on ${date.toISOString().slice(0, 10)}`);
      } else {
        console.log(`  Already exists: ${eventName} on ${date.toISOString().slice(0, 10)}`);
      }
    }
  }

  console.log(`  Upcoming events created: ${upcomingCreated}`);
  console.log("\n=== Import Complete ===");
  console.log(`  Members created: ${totalMembers}`);
  console.log(`  Events created: ${totalEvents} (from Excel) + ${upcomingCreated} (upcoming)`);
  console.log(`  Attendance records: ${totalAttendance}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
