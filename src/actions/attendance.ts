"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserSubTreeMemberIds } from "@/lib/team-tree";

type AttendanceRecord = {
  memberId: string;
  status: string;
};

type ActionResult = { success?: boolean; error?: string };

const VALID_STATUSES = ["present", "absent", "excused"];

export async function markAttendance(eventId: string, records: AttendanceRecord[]): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  if (!eventId?.trim()) return { error: "Event ID is required" };
  if (!Array.isArray(records) || records.length === 0) return { error: "Attendance records are required" };

  for (const record of records) {
    if (!record.memberId) return { error: "Each record must have a memberId" };
    if (!VALID_STATUSES.includes(record.status)) {
      return { error: `Invalid status "${record.status}". Must be present, absent, or excused` };
    }
  }

  // For non-admins, verify all members are in their sub-tree
  if (!isAdmin(session.roles)) {
    const subTreeIds = await getUserSubTreeMemberIds(session.id);

    if (subTreeIds === null) {
      return { error: "Your account is not linked to any team member" };
    }

    const subTreeSet = new Set(subTreeIds);
    const outOfScope = records.filter((r) => !subTreeSet.has(r.memberId));

    if (outOfScope.length > 0) {
      return { error: "You can only mark attendance for members in your team" };
    }
  }

  try {
    for (const record of records) {
      await prisma.attendance.upsert({
        where: {
          eventId_memberId: {
            eventId,
            memberId: record.memberId,
          },
        },
        update: {
          status: record.status,
          markedById: session.id,
        },
        create: {
          eventId,
          memberId: record.memberId,
          status: record.status,
          markedById: session.id,
        },
      });
    }

    revalidatePath("/attendance");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { error: "Failed to save attendance" };
  }
}
