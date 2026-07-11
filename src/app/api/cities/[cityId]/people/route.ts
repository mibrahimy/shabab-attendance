// GET /api/cities/[cityId]/people?q= — search people in a city (reports drill-down).

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
    const q = new URL(req.url).searchParams.get("q") ?? "";
    const people = await reportService.searchPeople(ctx, cityId, q);
    return NextResponse.json({ data: { people } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
