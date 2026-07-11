// GET  /api/cities/[cityId]/levels — the city's editable levels + head-role options.
// POST /api/cities/[cityId]/levels — add a level (manage_city).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as structureService from "@/server/services/structure-service";

export async function GET(req: Request, { params }: { params: Promise<{ cityId: string }> }): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const { cityId } = await params;
    const data = await structureService.listLevels(ctx, cityId);
    return NextResponse.json({ data });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const postSchema = z.object({
  name: z.string().min(1, "Level name is required"),
  afterLevelId: z.string().min(1).nullable().optional(),
  color: z.string().min(1).nullable().optional(),
  headPositionKey: z.string().min(1).nullable().optional(),
});

export async function POST(req: Request, { params }: { params: Promise<{ cityId: string }> }): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const { cityId } = await params;
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    await structureService.addLevel(ctx, cityId, parsed.data);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
