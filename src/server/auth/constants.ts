// v2 session config. Distinct cookie name from v1 (`session-token`) so the two
// apps' cookies never collide during the transition.

export const SESSION_COOKIE_NAME = "sb_session";

// ~8h session, sliding: re-issued once a request arrives past roughly half its
// life, so an active session never expires mid-class but a forgotten one dies in
// a working day (ENGINEERING.md §12).
export const SESSION_TTL_SECONDS = 8 * 60 * 60;
export const SESSION_REISSUE_AFTER_SECONDS = SESSION_TTL_SECONDS / 2;

// HS256 secret, reused from env (same pattern as src/lib/constants.ts). MUST be
// set in production — the dev fallback is intentionally obvious.
export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production",
);
