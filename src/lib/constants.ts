export const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "dev-secret-change-in-production"
);

export const SESSION_COOKIE_NAME = "session-token";
export const SESSION_EXPIRY_DAYS = 7;
