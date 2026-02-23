"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/roles";

type ActionResult = { success?: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["super_admin", "admin", "teacher"];

export async function createUser(data: {
  email: string;
  password: string;
  name: string;
  phone?: string;
  roles: string;
}): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAdmin(session.roles)) return { error: "Unauthorized" };

  const email = data.email?.trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email)) return { error: "Valid email is required" };

  const name = data.name?.trim();
  if (!name || name.length < 2) return { error: "Name is required (min 2 characters)" };

  const password = data.password;
  if (!password || password.length < 6) return { error: "Password must be at least 6 characters" };

  if (!VALID_ROLES.includes(data.roles)) return { error: "Invalid role" };

  // Non-super_admin cannot create super_admin users
  if (data.roles === "super_admin" && !isSuperAdmin(session.roles)) {
    return { error: "Only super admins can create super admin users" };
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return { error: "A user with this email already exists" };

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone: data.phone?.trim() || null,
        roles: data.roles,
      },
    });

    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Failed to create user" };
  }
}

export async function toggleUserActive(userId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAdmin(session.roles)) return { error: "Unauthorized" };

  if (userId === session.id) return { error: "Cannot deactivate your own account" };

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isActive: true, roles: true },
    });
    if (!user) return { error: "User not found" };

    // Non-super_admin cannot toggle super_admin users
    if (user.roles === "super_admin" && !isSuperAdmin(session.roles)) {
      return { error: "Only super admins can modify super admin users" };
    }

    await prisma.user.update({
      where: { id: userId },
      data: { isActive: !user.isActive },
    });

    revalidatePath("/users");
    return { success: true };
  } catch {
    return { error: "Failed to update user" };
  }
}

export async function linkUserToMember(userId: string, memberId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAdmin(session.roles)) return { error: "Unauthorized" };

  try {
    // Check no other member already has this userId
    const existingLink = await prisma.member.findFirst({
      where: { userId, id: { not: memberId } },
      select: { id: true, name: true },
    });
    if (existingLink) {
      return { error: `This user is already linked to member "${existingLink.name}"` };
    }

    await prisma.member.update({
      where: { id: memberId },
      data: { userId },
    });

    revalidatePath("/users");
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to link user to member" };
  }
}

export async function unlinkUserFromMember(memberId: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session || !isAdmin(session.roles)) return { error: "Unauthorized" };

  try {
    await prisma.member.update({
      where: { id: memberId },
      data: { userId: null },
    });

    revalidatePath("/users");
    revalidatePath("/team");
    return { success: true };
  } catch {
    return { error: "Failed to unlink user from member" };
  }
}
