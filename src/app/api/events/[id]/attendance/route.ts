// POST /api/events/[id]/attendance — idempotent batch upsert of marks (offline sync
// target). Safe to replay; last-write-wins by clientUpdatedAt. Returns which persons
// were synced vs. skipped so the client can clear its outbox.

import { NextResponse } from "next/server";
import { z } from "zod";
import { ValidationError, toErrorResponse } from "@/server/errors";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as attendanceService from "@/server/services/attendance-service";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  marks: z
    .array(
      z.object({
        personId: z.string().min(1),
        status: z.enum(["present", "late", "absent", "excused"]),
        clientUpdatedAt: z.string().datetime(),
        overrideReason: z.string().optional(),
      }),
    )
    .max(500),
});

export async function POST(req: Request, { params }: Params): Promise<NextResponse> {
  try {
    const { id } = await params;
    const ctx = await getAuthzContext(req);
    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }
    const result = await attendanceService.submitMarks(
      ctx,
      id,
      parsed.data.marks.map((m) => ({
        personId: m.personId,
        status: m.status,
        clientUpdatedAt: new Date(m.clientUpdatedAt),
        overrideReason: m.overrideReason,
      })),
    );
    return NextResponse.json({ data: result });
  } catch (err) {
    const { status, body } = toErrorResponse(err);
    return NextResponse.json(body, { status });
  }
}
