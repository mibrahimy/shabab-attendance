// Session primitives: sign/verify the identity JWT and read/write it as an
// httpOnly cookie. The same token is also accepted via an `Authorization: Bearer`
// header for native clients (ENGINEERING.md §12) — only the transport differs.
//
// sign/verify are pure jose (safe to import from edge middleware); the cookie
// helpers use next/headers and are for route handlers / Server Components.

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import type { SessionClaims } from "@/types/auth";
import { UnauthorizedError } from "@/server/errors";
import {
  JWT_SECRET,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
} from "./constants";

export async function signSession(claims: SessionClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(JWT_SECRET);
}

export async function verifySession(token: string): Promise<SessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    return toClaims(payload);
  } catch {
    return null;
  }
}

// Narrow the verified JWT payload to our claim shape; reject anything malformed.
function toClaims(payload: Record<string, unknown>): SessionClaims | null {
  const { sub, pid, cid, mcp, v } = payload as Partial<SessionClaims>;
  if (typeof sub !== "string" || typeof pid !== "string") return null;
  if (typeof mcp !== "boolean" || typeof v !== "number") return null;
  if (cid !== null && typeof cid !== "string") return null;
  return { sub, pid, cid, mcp, v };
}

export async function setSessionCookie(token: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_TTL_SECONDS,
    path: "/",
  });
}

export async function clearSessionCookie(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
}

// Read the raw token from a Bearer header (native clients) or the cookie (web).
async function getRawToken(req?: Request): Promise<string | null> {
  const authHeader = req?.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim() || null;
  }
  const store = await cookies();
  return store.get(SESSION_COOKIE_NAME)?.value ?? null;
}

// Verified claims or throw — the entry point for route handlers / Server
// Components. Authorization (what the user may do) is resolved separately by
// getAuthzContext; this only proves WHO they are.
export async function requireSession(req?: Request): Promise<SessionClaims> {
  const token = await getRawToken(req);
  if (!token) throw new UnauthorizedError();
  const claims = await verifySession(token);
  if (!claims) throw new UnauthorizedError();
  return claims;
}
