// GET /api/cities/[cityId]/nodes?q= — search zones/parks/classes in a city (the
// reports "jump to a location" picker).

import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as reportService from "@/server/services/report-service";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cityId: string }> },
): Promise<NextResponse> {
  try {
    const { cityId } = await params;
    const ctx = await getAuthzContext(req);
    const sp = new URL(req.url).searchParams;
    const q = sp.get("q") ?? "";
    const node = sp.get("node") ?? undefined;
    const nodes = await reportService.searchNodes(ctx, cityId, q, node);
    return NextResponse.json({ data: { nodes } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
