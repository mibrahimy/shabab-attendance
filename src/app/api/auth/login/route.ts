// POST /api/auth/login — thin handler: validate → service → issue session.

import { NextResponse } from "next/server";
import { z } from "zod";
import type { LoginResponse } from "@/types/auth";
import { ValidationError, toErrorResponse } from "@/server/errors";
import * as authService from "@/server/services/auth-service";
import { signSession, setSessionCookie } from "@/server/auth/session";

const bodySchema = z.object({
  identifier: z.string().min(1, "Enter your CNIC or email"),
  password: z.string().min(1, "Enter your password"),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const { claims, mustChangePassword } = await authService.login(parsed.data);
    const token = await signSession(claims);
    await setSessionCookie(token);

    const body: LoginResponse = { mustChangePassword };
    return NextResponse.json({ data: body });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
