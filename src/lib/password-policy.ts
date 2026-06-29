// Password policy — the SINGLE source of truth shared by the change-password UI
// (live strength feedback) and the server (enforcement at the boundary). Keeping
// one module means the meter the user sees can never drift from what the server
// accepts. Pure: no React, no Prisma.
//
// Policy (target-architecture.html point 16B): ≥12 chars, with at least one
// uppercase, one lowercase, one digit, and one symbol.

export const PASSWORD_MIN_LENGTH = 12;

export type PasswordCriterion = "minLength" | "upper" | "lower" | "digit" | "symbol";

export type PasswordChecks = Record<PasswordCriterion, boolean>;

export type PasswordResult = {
  checks: PasswordChecks;
  valid: boolean;
};

// Human-readable labels for each criterion — used by the UI so the wording stays
// in sync with the rules themselves.
export const PASSWORD_CRITERIA: { key: PasswordCriterion; label: string }[] = [
  { key: "minLength", label: `At least ${PASSWORD_MIN_LENGTH} characters` },
  { key: "upper", label: "An uppercase letter (A–Z)" },
  { key: "lower", label: "A lowercase letter (a–z)" },
  { key: "digit", label: "A number (0–9)" },
  { key: "symbol", label: "A symbol (e.g. !@#$%)" },
];

export function checkPassword(password: string): PasswordResult {
  const checks: PasswordChecks = {
    minLength: password.length >= PASSWORD_MIN_LENGTH,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /[0-9]/.test(password),
    // Anything that isn't a letter, digit, or whitespace counts as a symbol.
    symbol: /[^A-Za-z0-9\s]/.test(password),
  };

  return {
    checks,
    valid: Object.values(checks).every(Boolean),
  };
}

export function isPasswordValid(password: string): boolean {
  return checkPassword(password).valid;
}
