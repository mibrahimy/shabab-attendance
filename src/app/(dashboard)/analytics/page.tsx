import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isSuperAdmin } from "@/lib/roles";
import AnalyticsClient from "./AnalyticsClient";

type Tally = { total: number; present: number };

function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(
    ((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7
  );
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function rate(t: Tally): number {
  return t.total > 0 ? Math.round((t.present / t.total) * 100) : 0;
}

function getOrInit<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let val = map.get(key);
  if (!val) {
    val = init();
    map.set(key, val);
  }
  return val;
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session || !isSuperAdmin(session.roles)) {
    redirect("/dashboard?denied=1");
  }

  const [parks, attendanceRecords] = await Promise.all([
    prisma.park.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      select: {
        status: true,
        event: {
          select: { date: true, parkId: true },
        },
      },
    }),
  ]);

  // Single pass: build both park totals and weekly breakdowns
  const parkStats = new Map<string, Tally>();
  const weeklyMap = new Map<
    string,
    { overall: Tally; byPark: Map<string, Tally> }
  >();

  for (const r of attendanceRecords) {
    const { parkId, date } = r.event;
    const isPresent = r.status === "present";

    // Park totals
    const park = getOrInit(parkStats, parkId, () => ({ total: 0, present: 0 }));
    park.total++;
    if (isPresent) park.present++;

    // Weekly breakdown
    const weekKey = getISOWeekKey(date);
    const week = getOrInit(weeklyMap, weekKey, () => ({
      overall: { total: 0, present: 0 },
      byPark: new Map(),
    }));
    week.overall.total++;
    if (isPresent) week.overall.present++;

    const weekPark = getOrInit(week.byPark, parkId, () => ({ total: 0, present: 0 }));
    weekPark.total++;
    if (isPresent) weekPark.present++;
  }

  const parkComparison = parks.map((p) => {
    const stats = parkStats.get(p.id) ?? { total: 0, present: 0 };
    return {
      name: p.name,
      rate: rate(stats),
      total: stats.total,
      present: stats.present,
    };
  });

  const trendData = Array.from(weeklyMap.keys())
    .sort()
    .map((weekKey) => {
      const week = weeklyMap.get(weekKey)!;
      const row: Record<string, string | number> = {
        week: weekKey,
        overall: rate(week.overall),
      };
      for (const [parkId, stats] of week.byPark) {
        row[parkId] = rate(stats);
      }
      return row;
    });

  const parkNames = Object.fromEntries(
    parks.map((p) => [p.id, p.name])
  );

  return (
    <div>
      <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">
        Analytics
      </h1>
      <AnalyticsClient
        parkComparison={parkComparison}
        trendData={trendData}
        parkNames={parkNames}
      />
    </div>
  );
}
