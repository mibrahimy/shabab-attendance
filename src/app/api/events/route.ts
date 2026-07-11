// GET  /api/events — today's events, scoped to the caller.
// POST /api/events — create an event at a node (create_event).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as eventService from "@/server/services/event-service";

const SCOPES = ["today", "upcoming", "past"] as const;

export async function GET(req: Request): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const params = new URL(req.url).searchParams;
    // ?nodes=1 → the nodes this caller may create an event at (for the create form).
    if (params.get("nodes") === "1") {
      const nodes = await eventService.listCreatableNodes(ctx);
      return NextResponse.json({ data: { nodes } });
    }
    const scopeParam = params.get("scope");
    const scope = SCOPES.find((s) => s === scopeParam) ?? "today";
    const events = await eventService.listEvents(ctx, scope);
    return NextResponse.json({ data: { events } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

const postSchema = z.object({
  nodeId: z.string().min(1),
  title: z.string().min(1, "Title is required"),
  scheduledAt: z.string().datetime({ message: "Invalid date/time" }),
  segment: z.enum(["junior", "senior"]).optional(),
  // null = whole subtree; a number = that many levels below the anchor (1 = direct).
  rosterDepth: z.number().int().min(1).nullable().optional(),
  audiencePositionId: z.string().min(1).nullable().optional(),
});

export async function POST(req: Request): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const parsed = postSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const result = await eventService.createEvent(ctx, {
      nodeId: parsed.data.nodeId,
      title: parsed.data.title,
      scheduledAt: new Date(parsed.data.scheduledAt),
      segment: parsed.data.segment,
      rosterDepth: parsed.data.rosterDepth,
      audiencePositionId: parsed.data.audiencePositionId,
    });
    return NextResponse.json({ data: result });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
