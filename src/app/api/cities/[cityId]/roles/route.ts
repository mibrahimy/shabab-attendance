// GET /api/cities/[cityId]/roles — the editable role catalog + permission list.

import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as rolesService from "@/server/services/roles-service";

type Params = { params: Promise<{ cityId: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { cityId } = await params;
    const ctx = await getAuthzContext(req);
    const data = await rolesService.listRoles(ctx, cityId);
    return NextResponse.json({ data });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
