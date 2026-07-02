// Authentication use-cases. Pure-ish: takes data, returns data / throws typed
// errors — no cookies or HTTP here (the route handles transport), which keeps
// this unit-testable.

import type { SessionClaims } from "@/types/auth";
import { checkPassword } from "@/lib/password-policy";
import { formatCnic } from "@/lib/cnic";
import { UnauthorizedError, ValidationError, NotFoundError } from "@/server/errors";
import * as userRepo from "@/server/repositories/user-repo";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export type LoginResult = {
  claims: SessionClaims;
  mustChangePassword: boolean;
};

export async function login(input: {
  identifier: string;
  password: string;
}): Promise<LoginResult> {
  // Canonicalize a CNIC identifier the same way it's stored (formatCnic leaves a
  // legacy email untouched), so login matches regardless of how the user typed it.
  const user = await userRepo.findByLoginIdentifier(formatCnic(input.identifier.trim()));

  // Uniform failure for "no such user" and "wrong password" so we don't reveal
  // which identifiers exist.
  const invalid = new UnauthorizedError("Invalid credentials");
  if (!user) throw invalid;

  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) throw invalid;

  if (!user.isActive || user.person.status !== "active") {
    throw new UnauthorizedError("Account is not active");
  }

  const claims: SessionClaims = {
    sub: user.id,
    pid: user.person.id,
    cid: user.person.cityId,
    mcp: user.mustChangePassword,
    v: user.tokenVersion,
  };

  return { claims, mustChangePassword: user.mustChangePassword };
}

// Returns fresh claims (mcp=false, bumped tokenVersion) so the caller can re-issue
// a session — the bump would otherwise invalidate the current one.
export async function changePassword(input: {
  userId: string;
  currentPassword: string;
  newPassword: string;
}): Promise<{ claims: SessionClaims }> {
  const account = await userRepo.findById(input.userId);
  if (!account) throw new NotFoundError("User not found");

  // Verify the current password against the stored hash.
  const currentHash = await userRepo.getPasswordHash(input.userId);
  if (!currentHash) throw new NotFoundError("User not found");
  const currentOk = await verifyPassword(input.currentPassword, currentHash);
  if (!currentOk) throw new ValidationError("Current password is incorrect", "WRONG_PASSWORD");

  if (input.currentPassword === input.newPassword) {
    throw new ValidationError("New password must be different", "SAME_PASSWORD");
  }
  if (!checkPassword(input.newPassword).valid) {
    throw new ValidationError("Password does not meet the requirements", "WEAK_PASSWORD");
  }

  const hash = await hashPassword(input.newPassword);
  const { tokenVersion } = await userRepo.updatePassword(input.userId, hash);

  const claims: SessionClaims = {
    sub: account.id,
    pid: account.person.id,
    cid: account.person.cityId,
    mcp: false,
    v: tokenVersion,
  };
  return { claims };
}
