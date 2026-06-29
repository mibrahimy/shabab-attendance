// Password hashing. bcrypt cost 12 — matches the seed (prisma/v2/seed.ts) so
// hashes are interchangeable.

import bcrypt from "bcryptjs";

const BCRYPT_COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
