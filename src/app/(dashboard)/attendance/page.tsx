import { prisma } from "@/lib/db";
import AttendanceClient from "./AttendanceClient";

interface AttendancePageProps {
  searchParams: Promise<{ eventId?: string }>;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const { eventId } = await searchParams;

  const events = await prisma.event.findMany({
    include: { park: true },
    orderBy: { date: "desc" },
  });

  return <AttendanceClient events={events} initialEventId={eventId} />;
}
