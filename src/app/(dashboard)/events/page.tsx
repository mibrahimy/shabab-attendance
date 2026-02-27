import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserScope } from "@/lib/team-tree";
import EventsClient from "./EventsClient";

export default async function EventsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  // Fire parks query immediately — it doesn't depend on scope
  const parksPromise = prisma.park.findMany({ orderBy: { name: "asc" } });

  let parkFilter: { parkId?: { in: string[] } } = {};

  if (!isAdmin(session.roles)) {
    const scope = await getUserScope(session.id);
    if (!scope || scope.parkIds.length === 0) {
      return <EventsClient events={[]} parks={await parksPromise} />;
    }
    parkFilter = { parkId: { in: scope.parkIds } };
  }

  const [events, parks] = await Promise.all([
    prisma.event.findMany({
      where: parkFilter,
      include: {
        park: true,
        _count: { select: { attendances: true } },
      },
      orderBy: { date: "desc" },
    }),
    parksPromise,
  ]);

  return <EventsClient events={events} parks={parks} />;
}
