import { prisma } from "@/lib/db";
import AttendanceClient from "./AttendanceClient";

export default async function AttendancePage() {
  const events = await prisma.event.findMany({
    include: { park: true },
    orderBy: { date: "desc" },
  });

  return <AttendanceClient events={events} />;
}
