// Generate a random temp password for admin-provisioned accounts. Guaranteed to
// satisfy the shared password policy (one of each required class, then padded to
// length with a mixed alphabet, then shuffled). Pure.

import { randomInt } from "node:crypto";
import { PASSWORD_MIN_LENGTH, isPasswordValid } from "./password-policy";

const UPPER = "ABCDEFGHJKMNPQRSTUVWXYZ"; // no I/O (look-alikes)
const LOWER = "abcdefghijkmnpqrstuvwxyz"; // no l
const DIGIT = "23456789"; // no 0/1
const SYMBOL = "!@#$%^&*-_+=?";
const ALL = UPPER + LOWER + DIGIT + SYMBOL;

const TEMP_PASSWORD_LENGTH = Math.max(PASSWORD_MIN_LENGTH + 2, 14);

function pick(alphabet: string): string {
  return alphabet[randomInt(alphabet.length)];
}

export function generateTempPassword(length: number = TEMP_PASSWORD_LENGTH): string {
  // Seed one of each required class so the policy always passes...
  const chars = [pick(UPPER), pick(LOWER), pick(DIGIT), pick(SYMBOL)];
  // ...then fill the rest from the full alphabet.
  while (chars.length < length) chars.push(pick(ALL));

  // Fisher–Yates shuffle so the seeded classes aren't always in front.
  for (let i = chars.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }

  const password = chars.join("");
  // Defensive: the construction guarantees validity, but never hand back a weak one.
  return isPasswordValid(password) ? password : generateTempPassword(length);
}
