import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserScope } from "@/lib/team-tree";
import AttendanceClient from "./AttendanceClient";

interface AttendancePageProps {
  searchParams: Promise<{ eventId?: string }>;
}

export default async function AttendancePage({ searchParams }: AttendancePageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { eventId } = await searchParams;

  let parkFilter: { parkId?: { in: string[] } } = {};

  if (!isAdmin(session.roles)) {
    const scope = await getUserScope(session.id);
    if (!scope || scope.parkIds.length === 0) {
      return <AttendanceClient events={[]} initialEventId={eventId} />;
    }
    parkFilter = { parkId: { in: scope.parkIds } };
  }

  const events = await prisma.event.findMany({
    where: parkFilter,
    include: {
      park: true,
      _count: { select: { attendances: true } },
    },
    orderBy: { date: "desc" },
  });

  return <AttendanceClient events={events} initialEventId={eventId} />;
}
