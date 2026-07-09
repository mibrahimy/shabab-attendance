// PATCH /api/org-nodes/[id] — rename ({name}) or move ({newParentId}). DELETE — guarded delete.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";

const patchSchema = z.union([
  z.object({ name: z.string().min(1, "Name is required") }),
  z.object({ newParentId: z.string().min(1, "Target is required") }),
]);

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    if ("newParentId" in parsed.data) {
      await hierarchyService.moveNode(ctx, { nodeId: id, newParentId: parsed.data.newParentId });
      return NextResponse.json({ data: { ok: true } });
    }
    const node = await hierarchyService.renameNode(ctx, { nodeId: id, name: parsed.data.name });
    return NextResponse.json({ data: { node } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    await hierarchyService.deleteNode(ctx, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
