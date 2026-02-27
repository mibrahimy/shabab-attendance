import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { getUserScope } from "@/lib/team-tree";
import { getDateRangeStart } from "@/lib/utils";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import AnalyticsClient from "./AnalyticsClient";

type Tally = { total: number; present: number; late: number };

type TopPerformer = {
  name: string;
  parkName: string;
  parkId: string;
  rate: number;
  total: number;
  present: number;
  late: number;
};

function rate(t: Tally): number {
  return t.total > 0 ? Math.round(((t.present + t.late) / t.total) * 100) : 0;
}

function getOrInit<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let val = map.get(key);
  if (!val) {
    val = init();
    map.set(key, val);
  }
  return val;
}

const TALLY_INIT = (): Tally => ({ total: 0, present: 0, late: 0 });

const MIN_RECORDS_FOR_TOP = 3;
const TOP_PER_PARK = 5;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const admin = isAdmin(session.roles);
  const superAdmin = isSuperAdmin(session.roles);

  // Access control: admins always allowed; non-admins need canManageTeam
  if (!admin) {
    const canManage = await prisma.member.findFirst({
      where: { userId: session.id, canManageTeam: true },
      select: { id: true },
    });
    if (!canManage) redirect("/dashboard?denied=1");
  }

  const scope = superAdmin ? null : await getUserScope(session.id);

  // Fetch filter options
  const [cities, allParks] = await Promise.all([
    prisma.city.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.park.findMany({
      select: { id: true, name: true, cityId: true },
      orderBy: { name: "asc" },
    }),
  ]);

  // Non-super-admins with no scope see an empty analytics page
  if (!superAdmin && (!scope || scope.parkIds.length === 0)) {
    return (
      <div>
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">
          Analytics
        </h1>
        <DashboardFilters cities={cities} parks={allParks} defaultRange="all" />
        <AnalyticsClient
          parkComparison={[]}
          trendData={[]}
          parkNames={{}}
          topPerformers={[]}
        />
      </div>
    );
  }

  // --- Read filter params ---
  const cityId = params.city ?? "";
  const parkId = params.park ?? "";
  const eventType = params.type ?? "";
  const range = params.range ?? "all";

  // --- Resolve scoped park IDs with filter intersection ---
  let scopedParkIds = scope?.parkIds ?? null;

  if (parkId) {
    // Single park filter
    const target = [parkId];
    scopedParkIds = scopedParkIds
      ? target.filter((id) => scopedParkIds!.includes(id))
      : target;
  } else if (cityId) {
    // City filter: narrow to parks in that city
    const cityParkIds = allParks
      .filter((p) => p.cityId === cityId)
      .map((p) => p.id);
    scopedParkIds = scopedParkIds
      ? cityParkIds.filter((id) => scopedParkIds!.includes(id))
      : cityParkIds;
  }

  // --- Event type filter ---
  const eventTypeFilter = eventType ? { type: eventType } : {};

  // --- Date range ---
  const rangeStart = getDateRangeStart(range);

  const [parks, attendanceRecords] = await Promise.all([
    prisma.park.findMany({
      where: scopedParkIds ? { id: { in: scopedParkIds } } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        ...(rangeStart ? { createdAt: { gte: rangeStart } } : {}),
        ...(scopedParkIds || eventType
          ? {
              event: {
                ...(scopedParkIds
                  ? { parkId: { in: scopedParkIds } }
                  : {}),
                ...eventTypeFilter,
              },
            }
          : {}),
      },
      select: {
        status: true,
        memberId: true,
        member: { select: { name: true, parkId: true } },
        event: { select: { date: true, parkId: true } },
      },
    }),
  ]);

  // Single pass: build park totals, per-date breakdowns, and member stats
  const parkStats = new Map<string, Tally>();
  const dateMap = new Map<
    string,
    { overall: Tally; byPark: Map<string, Tally> }
  >();
  const memberStats = new Map<
    string,
    { name: string; parkId: string | null; total: number; present: number; late: number }
  >();

  for (const r of attendanceRecords) {
    const { parkId: recParkId, date } = r.event;
    const isPresent = r.status === "present";
    const isLate = r.status === "late";

    // Park totals
    const park = getOrInit(parkStats, recParkId, TALLY_INIT);
    park.total++;
    if (isPresent) park.present++;
    if (isLate) park.late++;

    // Per-date breakdown (YYYY-MM-DD for sorting, displayed as short date)
    const dateKey = new Date(date).toISOString().slice(0, 10);
    const dayBucket = getOrInit(dateMap, dateKey, () => ({
      overall: TALLY_INIT(),
      byPark: new Map(),
    }));
    dayBucket.overall.total++;
    if (isPresent) dayBucket.overall.present++;
    if (isLate) dayBucket.overall.late++;

    const dayPark = getOrInit(dayBucket.byPark, recParkId, TALLY_INIT);
    dayPark.total++;
    if (isPresent) dayPark.present++;
    if (isLate) dayPark.late++;

    // Member stats (for top performers)
    if (r.memberId) {
      const ms = getOrInit(memberStats, r.memberId, () => ({
        name: r.member?.name ?? "Unknown",
        parkId: r.member?.parkId ?? null,
        total: 0,
        present: 0,
        late: 0,
      }));
      ms.total++;
      if (isPresent) ms.present++;
      if (isLate) ms.late++;
    }
  }

  const parkComparison = parks.map((p) => {
    const stats = parkStats.get(p.id) ?? TALLY_INIT();
    return {
      name: p.name,
      rate: rate(stats),
      total: stats.total,
      present: stats.present,
    };
  });

  const trendData = Array.from(dateMap.keys())
    .sort()
    .map((dateKey) => {
      const bucket = dateMap.get(dateKey)!;
      const d = new Date(dateKey + "T00:00:00");
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const row: Record<string, string | number> = {
        date: label,
        overall: rate(bucket.overall),
      };
      for (const [pId, stats] of bucket.byPark) {
        row[pId] = rate(stats);
      }
      return row;
    });

  const parkNames = Object.fromEntries(parks.map((p) => [p.id, p.name]));

  // Top performers: group by park, sort by rate, take top 5
  const byPark = new Map<string, TopPerformer[]>();
  for (const [, ms] of memberStats) {
    if (ms.total < MIN_RECORDS_FOR_TOP || !ms.parkId) continue;
    const list = getOrInit(byPark, ms.parkId, () => [] as TopPerformer[]);
    list.push({
      name: ms.name,
      parkName: parkNames[ms.parkId] ?? ms.parkId,
      parkId: ms.parkId,
      rate: rate(ms),
      total: ms.total,
      present: ms.present,
      late: ms.late,
    });
  }

  const topPerformers: TopPerformer[] = [];
  for (const [, members] of byPark) {
    members.sort((a, b) => b.rate - a.rate || b.total - a.total);
    topPerformers.push(...members.slice(0, TOP_PER_PARK));
  }

  return (
    <div>
      <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">
        Analytics
      </h1>
      <DashboardFilters cities={cities} parks={allParks} defaultRange="all" />
      <AnalyticsClient
        parkComparison={parkComparison}
        trendData={trendData}
        parkNames={parkNames}
        topPerformers={topPerformers}
      />
    </div>
  );
}
