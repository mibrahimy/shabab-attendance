// v2 session config. Distinct cookie name from v1 (`session-token`) so the two
// apps' cookies never collide during the transition.

export const SESSION_COOKIE_NAME = "sb_session";

// ~8h session, sliding: re-issued once a request arrives past roughly half its
// life, so an active session never expires mid-class but a forgotten one dies in
// a working day (ENGINEERING.md §12).
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const SESSION_REISSUE_AFTER_SECONDS = SESSION_TTL_SECONDS / 2;

// HS256 secret from env. In production JWT_SECRET MUST be set — otherwise every
// token would be signed with a publicly-known constant and anyone could forge a
// superadmin session. Fail fast at boot rather than silently using the dev value.
function resolveJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (secret) return new TextEncoder().encode(secret);
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET must be set in production (refusing a forgeable dev fallback).");
  }
  return new TextEncoder().encode("dev-secret-change-in-production");
}

export const JWT_SECRET = resolveJwtSecret();
