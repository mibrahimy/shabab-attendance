// PUT /api/cities/[cityId]/roles/[canonicalKey] — replace a role's permission grants.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as rolesService from "@/server/services/roles-service";

type Params = { params: Promise<{ cityId: string; canonicalKey: string }> };

const putSchema = z.object({ permissionKeys: z.array(z.string()) });

export async function PUT(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { cityId, canonicalKey } = await params;
    const ctx = await getAuthzContext(req);
    const parsed = putSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    await rolesService.setRolePermissions(ctx, cityId, canonicalKey, parsed.data.permissionKeys);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
