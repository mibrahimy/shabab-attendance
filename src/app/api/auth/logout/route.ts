// POST /api/auth/logout — clear the session cookie. (tokenVersion isn't bumped:
// logout is local; full revocation is a separate concern.)

import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors";
import { clearSessionCookie } from "@/server/auth/session";

export async function POST(): Promise<NextResponse> {
  try {
    await clearSessionCookie();
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
