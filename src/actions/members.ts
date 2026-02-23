"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserSubTreeMemberIds } from "@/lib/team-tree";

type MemberInput = {
  name: string;
  phone?: string;
  positionLabel: string;
  parkId?: string;
  parentId?: string;
  isTeaching: boolean;
  classAssignment?: string;
  canManageTeam: boolean;
};

type ActionResult = { success?: boolean; error?: string };

const PHONE_RE = /^\+?\d{7,15}$/;

function validateMemberInput(data: MemberInput): string | null {
  const name = data.name?.trim();
  if (!name || name.length < 2) return "Name is required (min 2 characters)";

  const position = data.positionLabel?.trim();
  if (!position) return "Position label is required";

  if (data.phone && data.phone.trim() && !PHONE_RE.test(data.phone.trim())) {
    return "Phone must be 7-15 digits, optionally starting with +";
  }

  return null;
}

function toMemberData(data: MemberInput) {
  return {
    name: data.name.trim(),
    phone: data.phone?.trim() || null,
    positionLabel: data.positionLabel.trim(),
    parkId: data.parkId || null,
    parentId: data.parentId || null,
    isTeaching: data.isTeaching,
    classAssignment: data.isTeaching ? data.classAssignment || null : null,
    canManageTeam: data.canManageTeam,
  };
}

async function wouldCreateCycle(memberId: string, newParentId: string): Promise<boolean> {
  let currentId: string | null = newParentId;
  const visited = new Set<string>();

  while (currentId) {
    if (currentId === memberId) return true;
    if (visited.has(currentId)) return false; // broken chain, bail out
    visited.add(currentId);

    const ancestor: { parentId: string | null } | null = await prisma.member.findUnique({
      where: { id: currentId },
      select: { parentId: true },
    });
    currentId = ancestor?.parentId ?? null;
  }

  return false;
}

async function isInUserSubTree(userId: string, targetId: string): Promise<boolean> {
  const subTreeIds = await getUserSubTreeMemberIds(userId);
  if (!subTreeIds) return false;
  return subTreeIds.includes(targetId);
}

export async function addMember(data: MemberInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  // Non-admins can only add members under their own sub-tree
  if (!isAdmin(session.roles)) {
    if (!data.parentId) {
      return { error: "You must specify a parent member" };
    }
    const allowed = await isInUserSubTree(session.id, data.parentId);
    if (!allowed) {
      return { error: "You can only add members under your own team" };
    }
  }

  const validationError = validateMemberInput(data);
  if (validationError) return { error: validationError };

  try {
    await prisma.member.create({ data: toMemberData(data) });
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to add member" };
  }
}

export async function updateMember(id: string, data: MemberInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  // Non-admins can only update members within their sub-tree
  if (!isAdmin(session.roles)) {
    const allowed = await isInUserSubTree(session.id, id);
    if (!allowed) {
      return { error: "You can only update members in your own team" };
    }
  }

  const validationError = validateMemberInput(data);
  if (validationError) return { error: validationError };

  if (data.parentId && data.parentId !== id) {
    const cycle = await wouldCreateCycle(id, data.parentId);
    if (cycle) return { error: "Cannot set parent: this would create a circular hierarchy" };
  }

  try {
    await prisma.member.update({ where: { id }, data: toMemberData(data) });
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to update member" };
  }
}

export async function removeMember(id: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  // Only admins can remove members
  if (!isAdmin(session.roles)) {
    return { error: "Only admins can remove members" };
  }

  if (!id) return { error: "Member ID is required" };

  try {
    const member = await prisma.member.findUnique({
      where: { id },
      select: { parentId: true, isTeaching: true, classAssignment: true },
    });

    if (!member) return { error: "Member not found" };

    if (member.isTeaching) {
      const label = member.classAssignment
        ? `teaching ${member.classAssignment}`
        : "a teaching member";
      return { error: `Cannot remove ${label}. Unassign their class first before removing.` };
    }

    await prisma.member.updateMany({
      where: { parentId: id },
      data: { parentId: member.parentId || null },
    });

    await prisma.attendance.deleteMany({ where: { memberId: id } });
    await prisma.member.delete({ where: { id } });
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to remove member. They may have linked data that needs to be cleared first." };
  }
}
