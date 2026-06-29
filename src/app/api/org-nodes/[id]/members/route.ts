// GET  /api/org-nodes/[id]/members — list active members at a node.
// POST /api/org-nodes/[id]/members — direct-add a member (student or staff).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as memberService from "@/server/services/member-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const members = await memberService.listNodeMembers(ctx, id);
    return NextResponse.json({ data: { members } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const postSchema = z.object({
  roleKey: z.string().min(1),
  person: z.object({
    name: z.string().min(1, "Name is required"),
    cnic: z.string().optional(),
    phone: z.string().optional(),
    segment: z.enum(["junior", "senior"]).optional(),
  }),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const result = await memberService.addMember(ctx, { nodeId: id, ...parsed.data });
    return NextResponse.json({ data: result });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
