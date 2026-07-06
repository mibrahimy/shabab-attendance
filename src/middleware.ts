// v2 middleware — AUTHENTICATION ONLY (ENGINEERING.md §12). On the edge it:
//   1. verifies the JWT signature + expiry (no DB, no authorization),
//   2. redirects unauthenticated users to /login (401 for API),
//   3. gates mustChangePassword (mcp) → forces /change-password,
//   4. slides the session: re-issues the cookie once past half its life.
// Authorization (canActOn) and tokenVersion revocation are resolved later, in
// getAuthzContext — never here.

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SignJWT, jwtVerify } from "jose";
import {
  JWT_SECRET,
  SESSION_COOKIE_NAME,
  SESSION_TTL_SECONDS,
  SESSION_REISSUE_AFTER_SECONDS,
} from "./server/auth/constants";

// Fully public — no token required.
const PUBLIC_PATHS = ["/login", "/api/auth/login"];
// Allowed while mcp is pending (so the user can actually change it / sign out).
const MCP_ALLOWED_PATHS = ["/change-password", "/api/auth/change-password", "/api/auth/logout"];

type Claims = { sub: string; pid: string; cid: string | null; mcp: boolean; v: number };

function isApi(pathname: string): boolean {
  return pathname.startsWith("/api");
}

function unauthenticated(req: NextRequest): NextResponse {
  if (isApi(req.nextUrl.pathname)) {
    return NextResponse.json({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }, { status: 401 });
  }
  return NextResponse.redirect(new URL("/login", req.url));
}

function readToken(req: NextRequest): string | null {
  const header = req.headers.get("authorization");
  if (header?.startsWith("Bearer ")) return header.slice(7).trim() || null;
  return req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
}

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const token = readToken(req);
  if (!token) return unauthenticated(req);

  let claims: Claims;
  let issuedAt: number | undefined;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    claims = payload as unknown as Claims;
    issuedAt = payload.iat;
  } catch {
    return unauthenticated(req);
  }

  // Force the password change before anything else.
  if (claims.mcp && !MCP_ALLOWED_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    if (isApi(pathname)) {
      return NextResponse.json(
        { error: { code: "PASSWORD_CHANGE_REQUIRED", message: "Password change required" } },
        { status: 403 },
      );
    }
    return NextResponse.redirect(new URL("/change-password", req.url));
  }

  const res = NextResponse.next();

  // Sliding session: re-issue once the token is past half its life.
  const nowSec = Math.floor(Date.now() / 1000);
  if (issuedAt && nowSec - issuedAt > SESSION_REISSUE_AFTER_SECONDS) {
    const refreshed = await new SignJWT({
      sub: claims.sub,
      pid: claims.pid,
      cid: claims.cid,
      mcp: claims.mcp,
      v: claims.v,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
      .sign(JWT_SECRET);

    res.cookies.set(SESSION_COOKIE_NAME, refreshed, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: SESSION_TTL_SECONDS,
      path: "/",
    });
  }

  return res;
}

export const config = {
  // Skip Next internals and any static file (a path with an extension, e.g.
  // /logo.png, /icons/*.png, sw.js, manifest.json) — otherwise the auth redirect
  // hijacks public assets and they fail to load.
  matcher: ["/((?!_next/static|_next/image|.*\\.[^/]+$).*)"],
};
