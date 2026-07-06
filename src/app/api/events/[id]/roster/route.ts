// GET /api/events/[id]/roster — the marker's slice of the roster, with current marks.

import { NextResponse } from "next/server";
import { toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as attendanceService from "@/server/services/attendance-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const data = await attendanceService.getMarkerRoster(ctx, id);
    return NextResponse.json({ data });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
