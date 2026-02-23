import { prisma } from "@/lib/db";
import EventsClient from "./EventsClient";

export default async function EventsPage() {
  const [events, parks] = await Promise.all([
    prisma.event.findMany({
      include: {
        park: true,
        _count: { select: { attendances: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.park.findMany({ orderBy: { name: "asc" } }),
  ]);

  return <EventsClient events={events} parks={parks} />;
}
