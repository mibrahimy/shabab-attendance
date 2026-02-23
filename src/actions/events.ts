"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { EVENT_TYPES } from "@/lib/utils";

type EventInput = {
  name: string;
  type: string;
  date: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  parkId: string;
  isRecurring: boolean;
};

type ActionResult = { success?: boolean; error?: string };

const VALID_EVENT_TYPES = Object.keys(EVENT_TYPES);
const VALID_STATUSES = ["scheduled", "completed", "cancelled"];

function validateEventInput(data: EventInput): string | null {
  if (!data.name?.trim()) return "Event name is required";
  if (!data.parkId?.trim()) return "Park is required";
  if (!data.date?.trim()) return "Date is required";

  if (!VALID_EVENT_TYPES.includes(data.type)) {
    return `Invalid event type: ${data.type}`;
  }

  if (data.type === "camp" && data.endDate) {
    if (new Date(data.endDate) < new Date(data.date)) {
      return "Camp end date must not be before start date";
    }
  }

  return null;
}

export async function createEvent(data: EventInput): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  const validationError = validateEventInput(data);
  if (validationError) return { error: validationError };

  try {
    await prisma.event.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        date: new Date(data.date),
        endDate: data.endDate ? new Date(data.endDate) : null,
        startTime: data.startTime || null,
        endTime: data.endTime || null,
        parkId: data.parkId,
        isRecurring: data.isRecurring,
      },
    });
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { error: "Failed to create event" };
  }
}

export async function updateEventStatus(id: string, status: string): Promise<ActionResult> {
  const session = await getSession();
  if (!session) return { error: "Unauthorized" };

  if (!id) return { error: "Event ID is required" };
  if (!VALID_STATUSES.includes(status)) {
    return { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(", ")}` };
  }

  try {
    await prisma.event.update({
      where: { id },
      data: { status },
    });
    revalidatePath("/events");
    revalidatePath("/dashboard");
    return { success: true };
  } catch {
    return { error: "Failed to update event status" };
  }
}
