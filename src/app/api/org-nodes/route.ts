// POST /api/org-nodes — add a child node under a parent (level resolved server-side).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";

const bodySchema = z.object({
  parentId: z.string().min(1),
  name: z.string().min(1, "Name is required"),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const node = await hierarchyService.addNode(ctx, parsed.data);
    return NextResponse.json({ data: { node } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
