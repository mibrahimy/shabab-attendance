// POST /api/countries — superadmin creates a Country under the global root.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as orgService from "@/server/services/org-service";

const bodySchema = z.object({ name: z.string().min(1, "Country name is required") });

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const country = await orgService.createCountry(ctx, parsed.data);
    return NextResponse.json({ data: { country } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
