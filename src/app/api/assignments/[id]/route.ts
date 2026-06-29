// DELETE /api/assignments/[id] — soft-remove a member from a node.
// PATCH  /api/assignments/[id] — move a member to another node/role.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as memberService from "@/server/services/member-service";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    await memberService.removeMember(ctx, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const patchSchema = z.object({
  targetNodeId: z.string().min(1),
  roleKey: z.string().min(1),
});

export async function PATCH(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const result = await memberService.moveMember(ctx, id, parsed.data);
    return NextResponse.json({ data: result });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
