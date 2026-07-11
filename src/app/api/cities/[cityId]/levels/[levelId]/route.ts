// PATCH  /api/cities/[cityId]/levels/[levelId] — rename / set head / set color / move.
// DELETE /api/cities/[cityId]/levels/[levelId] — remove an empty level. (manage_city)

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as structureService from "@/server/services/structure-service";

const patchSchema = z.union([
  z.object({ name: z.string().min(1) }),
  z.object({ headPositionKey: z.string().min(1).nullable() }),
  z.object({ color: z.string().min(1) }),
  z.object({ move: z.enum(["up", "down"]) }),
]);

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ cityId: string; levelId: string }> },
): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const { cityId, levelId } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    const d = parsed.data;
    if ("name" in d) await structureService.renameLevel(ctx, cityId, levelId, d.name);
    else if ("headPositionKey" in d) await structureService.setLevelHead(ctx, cityId, levelId, d.headPositionKey);
    else if ("color" in d) await structureService.setLevelColor(ctx, cityId, levelId, d.color);
    else await structureService.moveLevel(ctx, cityId, levelId, d.move);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ cityId: string; levelId: string }> },
): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const { cityId, levelId } = await params;
    await structureService.removeLevel(ctx, cityId, levelId);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
