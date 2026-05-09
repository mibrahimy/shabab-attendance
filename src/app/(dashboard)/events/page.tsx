import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserScope, getUserManagedParkIds } from "@/lib/team-tree";
import EventsClient from "./EventsClient";

export default async function EventsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = isAdmin(session.roles);
  let scopedParkIds: string[] | null = null;

  if (!admin) {
    const scope = await getUserScope(session.id);
    if (!scope || scope.parkIds.length === 0) {
      const managedParkIds = await getUserManagedParkIds(session.id);
      if (managedParkIds.length === 0) {
        return <EventsClient events={[]} parks={[]} />;
      }
      scopedParkIds = managedParkIds;
    } else {
      scopedParkIds = scope.parkIds;
    }
  }

  const parkFilter = scopedParkIds ? { parkId: { in: scopedParkIds } } : {};

  const [events, allParks] = await Promise.all([
    prisma.event.findMany({
      where: parkFilter,
      include: {
        park: true,
        _count: { select: { attendances: true } },
      },
      orderBy: { date: "desc" },
    }),
    prisma.park.findMany({ orderBy: { name: "asc" } }),
  ]);

  const parks = scopedParkIds
    ? allParks.filter((p) => scopedParkIds!.includes(p.id))
    : allParks;

  return <EventsClient events={events} parks={parks} />;
}
