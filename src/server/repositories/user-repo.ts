// User data access (the only Prisma layer). Scoped, minimal selects.

import { prisma } from "@/server/db";
import type { Db } from "./org-node-repo";

export type AuthUser = {
  id: string;
  passwordHash: string;
  mustChangePassword: boolean;
  isActive: boolean;
  tokenVersion: number;
  person: {
    id: string;
    status: "pending" | "active" | "rejected";
    cityId: string | null;
  };
};

// Login resolves by Person.cnic (new accounts) OR User.email (legacy) —
// MIGRATION.md / target-architecture.html point 24.
export async function findByLoginIdentifier(identifier: string): Promise<AuthUser | null> {
  return prisma.user.findFirst({
    where: {
      OR: [{ person: { cnic: identifier } }, { email: identifier }],
    },
    select: {
      id: true,
      passwordHash: true,
      mustChangePassword: true,
      isActive: true,
      tokenVersion: true,
      person: { select: { id: true, status: true, cityId: true } },
    },
  });
}

export type UserIdentity = Omit<AuthUser, "passwordHash">;

export async function getPasswordHash(userId: string): Promise<string | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: { passwordHash: true },
  });
  return row?.passwordHash ?? null;
}

export async function findById(userId: string): Promise<UserIdentity | null> {
  return prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      mustChangePassword: true,
      isActive: true,
      tokenVersion: true,
      person: { select: { id: true, status: true, cityId: true } },
    },
  });
}

export async function create(
  input: {
    personId: string;
    passwordHash: string;
    mustChangePassword?: boolean;
    email?: string | null;
  },
  db: Db = prisma,
): Promise<{ id: string }> {
  return db.user.create({
    data: {
      personId: input.personId,
      passwordHash: input.passwordHash,
      mustChangePassword: input.mustChangePassword ?? true,
      email: input.email ?? null,
    },
    select: { id: true },
  });
}

// Set a new password and bump tokenVersion in one update (invalidates existing
// sessions). Returns the new tokenVersion so the caller can re-issue a token.
export async function updatePassword(
  userId: string,
  passwordHash: string,
): Promise<{ tokenVersion: number }> {
  const updated = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      mustChangePassword: false,
      tokenVersion: { increment: 1 },
    },
    select: { tokenVersion: true },
  });
  return updated;
}
