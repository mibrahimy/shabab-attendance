import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";

export async function GET() {
  const session = await getSession();
  if (!session || !isSuperAdmin(session.roles)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [members, attendances] = await Promise.all([
    prisma.member.findMany({
      select: {
        id: true,
        name: true,
        positionLabel: true,
        parentId: true,
      },
    }),
    prisma.attendance.findMany({
      include: {
        event: { select: { name: true, date: true } },
        member: { select: { id: true, name: true, positionLabel: true } },
        markedBy: { select: { name: true } },
      },
    }),
  ]);

  // Build parentId lookup for walking up the tree
  const memberMap = new Map(members.map((m) => [m.id, m]));

  // Walk each member up to its root ancestor (zone lead)
  function getRootAncestorId(memberId: string): string {
    let currentId = memberId;
    const visited = new Set<string>();
    while (true) {
      if (visited.has(currentId)) break; // cycle guard
      visited.add(currentId);
      const member = memberMap.get(currentId);
      if (!member || !member.parentId) break;
      currentId = member.parentId;
    }
    return currentId;
  }

  // Group attendance rows by zone (root ancestor)
  const zoneGroups = new Map<string, typeof attendances>();
  for (const record of attendances) {
    const rootId = getRootAncestorId(record.member.id);
    if (!zoneGroups.has(rootId)) zoneGroups.set(rootId, []);
    zoneGroups.get(rootId)!.push(record);
  }

  // Also ensure zones with members but no attendance get a sheet
  for (const member of members) {
    const rootId = getRootAncestorId(member.id);
    if (!zoneGroups.has(rootId)) zoneGroups.set(rootId, []);
  }

  const wb = XLSX.utils.book_new();
  const usedNames = new Set<string>();
  const headers = ["Member Name", "Position", "Event Name", "Event Date", "Status", "Marked By"];

  for (const [rootId, records] of zoneGroups) {
    const rootMember = memberMap.get(rootId);
    let rawName = rootMember?.name || "Unknown Zone";
    // Strip special characters not allowed in sheet names and truncate
    let sheetName = rawName.replace(/[\\/*?:\[\]]/g, "").slice(0, 31);
    if (!sheetName) sheetName = "Zone";

    // Handle duplicate sheet names
    let finalName = sheetName;
    let suffix = 2;
    while (usedNames.has(finalName)) {
      const suffixStr = ` ${suffix}`;
      finalName = sheetName.slice(0, 31 - suffixStr.length) + suffixStr;
      suffix++;
    }
    usedNames.add(finalName);

    const rows = records.map((r) => [
      r.member.name,
      r.member.positionLabel,
      r.event.name,
      new Date(r.event.date).toLocaleDateString("en-GB"),
      r.status,
      r.markedBy?.name || "",
    ]);

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    XLSX.utils.book_append_sheet(wb, ws, finalName);
  }

  // If no zones at all, create a single empty sheet
  if (wb.SheetNames.length === 0) {
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, "No Data");
  }

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="attendance-export.xlsx"',
    },
  });
}
