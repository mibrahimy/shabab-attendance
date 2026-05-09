import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { computeAttendanceSummary } from "@/lib/utils";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserSubTreeMemberIds, getUserManagedParkIds } from "@/lib/team-tree";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const eventId = request.nextUrl.searchParams.get("eventId");

  if (!eventId) {
    return NextResponse.json({ error: "eventId required" }, { status: 400 });
  }

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    select: { parkId: true },
  });

  if (!event) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  // Get all park members first
  let members = await prisma.member.findMany({
    where: { parkId: event.parkId },
    select: {
      id: true,
      name: true,
      positionLabel: true,
      classAssignment: true,
    },
    orderBy: { name: "asc" },
  });

  let warning: string | undefined;

  // For non-admins, scope visible members
  if (!isAdmin(session.roles)) {
    const managedParkIds = await getUserManagedParkIds(session.id);

    if (managedParkIds.includes(event.parkId)) {
      // Park managers see all members of the event's park — no further filtering needed
    } else {
      const subTreeIds = await getUserSubTreeMemberIds(session.id);

      if (subTreeIds === null) {
        return NextResponse.json({
          members: [],
          existing: [],
          report: { records: [], summary: { total: 0, present: 0, late: 0, absent: 0, excused: 0, rate: 0 } },
          warning: "Your account is not linked to any team member. Ask an admin to link your account.",
        });
      }

      const subTreeSet = new Set(subTreeIds);
      members = members.filter((m) => subTreeSet.has(m.id));
    }
  }

  const memberIds = members.map((m) => m.id);

  // Fetch existing attendance records, filtered to visible members
  const existingRecords = await prisma.attendance.findMany({
    where: {
      eventId,
      memberId: { in: memberIds },
    },
    include: {
      member: {
        select: { id: true, name: true, classAssignment: true, positionLabel: true },
      },
      markedBy: {
        select: { id: true, name: true, email: true },
      },
    },
  });

  return NextResponse.json({
    members,
    existing: existingRecords.map((r) => ({
      memberId: r.memberId,
      status: r.status,
    })),
    report: {
      records: existingRecords,
      summary: computeAttendanceSummary(existingRecords, members.length),
    },
    ...(warning ? { warning } : {}),
  });
}
