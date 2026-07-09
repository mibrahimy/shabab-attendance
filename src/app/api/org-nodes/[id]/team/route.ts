// GET /api/org-nodes/[id]/team — the node's derived team (its head + its direct
// children's heads). Read-only; scoped by manage_hierarchy on the node.

import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const team = await hierarchyService.getNodeTeam(ctx, id);
    return NextResponse.json({ data: team });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
