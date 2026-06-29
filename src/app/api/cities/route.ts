// POST /api/cities — superadmin creates a City under a Country and provisions its
// City Admin inline; returns the one-time temp password.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as orgService from "@/server/services/org-service";

const bodySchema = z.object({
  countryId: z.string().min(1),
  name: z.string().min(1, "City name is required"),
  admin: z.object({
    name: z.string().min(1, "Admin name is required"),
    cnic: z.string().min(1, "Admin CNIC is required"),
    phone: z.string().optional(),
  }),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const result = await orgService.createCity(ctx, parsed.data);
    return NextResponse.json({ data: result });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
