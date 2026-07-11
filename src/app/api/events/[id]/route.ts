// PATCH  /api/events/[id] — edit title / time (create_event on the event's node).
// DELETE /api/events/[id] — soft-cancel the event (status → cancelled).

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as eventService from "@/server/services/event-service";

const patchSchema = z
  .object({
    title: z.string().min(1, "Title is required").optional(),
    scheduledAt: z.string().datetime({ message: "Invalid date/time" }).optional(),
  })
  .refine((v) => v.title !== undefined || v.scheduledAt !== undefined, {
    message: "Nothing to update",
  });

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const { id } = await params;
    const parsed = patchSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    await eventService.updateEvent(ctx, id, {
      title: parsed.data.title,
      scheduledAt: parsed.data.scheduledAt ? new Date(parsed.data.scheduledAt) : undefined,
    });
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const ctx = await getAuthzContext(req);
    const { id } = await params;
    await eventService.cancelEvent(ctx, id);
    return NextResponse.json({ data: { ok: true } });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
