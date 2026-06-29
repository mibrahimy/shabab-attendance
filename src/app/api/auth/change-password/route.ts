// POST /api/auth/change-password — authenticated. Validates, delegates, then
// re-issues a fresh session (the tokenVersion bump would otherwise invalidate the
// caller's current token mid-request).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import * as authService from "@/server/services/auth-service";
import { requireSession, signSession, setSessionCookie } from "@/server/auth/session";

const bodySchema = z.object({
  currentPassword: z.string().min(1, "Enter your current password"),
  newPassword: z.string().min(1, "Enter a new password"),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const session = await requireSession(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { claims } = await authService.changePassword({
      userId: session.sub,
      currentPassword: parsed.data.currentPassword,
      newPassword: parsed.data.newPassword,
    });

    const token = await signSession(claims);
    await setSessionCookie(token);

    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
