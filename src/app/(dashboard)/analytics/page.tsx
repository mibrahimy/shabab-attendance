import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin, isSuperAdmin } from "@/lib/roles";
import { getUserScope } from "@/lib/team-tree";
import { getDateRangeStart, attendanceRate } from "@/lib/utils";
import DashboardFilters from "@/components/dashboard/DashboardFilters";
import AnalyticsClient from "./AnalyticsClient";

type Tally = { present: number; late: number };

type TopPerformer = {
  name: string;
  parkName: string;
  parkId: string;
  rate: number;
  total: number;
  present: number;
  late: number;
};

function getOrInit<K, V>(map: Map<K, V>, key: K, init: () => V): V {
  let val = map.get(key);
  if (!val) {
    val = init();
    map.set(key, val);
  }
  return val;
}

const TALLY_INIT = (): Tally => ({ present: 0, late: 0 });

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

  const [parks, attendanceRecords, memberCounts, completedEvents] = await Promise.all([
    prisma.park.findMany({
      where: scopedParkIds ? { id: { in: scopedParkIds } } : undefined,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      where: {
        event: {
          status: "completed",
          ...(rangeStart ? { date: { gte: rangeStart } } : {}),
          ...(scopedParkIds
            ? { parkId: { in: scopedParkIds } }
            : {}),
          ...eventTypeFilter,
        },
      },
      select: {
        status: true,
        memberId: true,
        member: { select: { name: true, parkId: true } },
        event: { select: { date: true, parkId: true } },
      },
    }),
    prisma.member.groupBy({
      by: ["parkId"],
      where: scopedParkIds ? { parkId: { in: scopedParkIds } } : undefined,
      _count: { _all: true },
    }),
    prisma.event.findMany({
      where: {
        status: "completed",
        ...(scopedParkIds ? { parkId: { in: scopedParkIds } } : {}),
        ...eventTypeFilter,
        ...(rangeStart ? { date: { gte: rangeStart } } : {}),
      },
      select: { parkId: true, date: true },
    }),
  ]);

  // Build member-count and completed-event maps for correct denominator
  const memberCountByPark = new Map<string, number>();
  for (const g of memberCounts) {
    if (g.parkId) memberCountByPark.set(g.parkId, g._count._all);
  }

  const eventCountByPark = new Map<string, number>();
  const eventsOnDate = new Map<string, Map<string, number>>();
  for (const e of completedEvents) {
    eventCountByPark.set(e.parkId, (eventCountByPark.get(e.parkId) ?? 0) + 1);
    const dk = new Date(e.date).toISOString().slice(0, 10);
    const dp = getOrInit(eventsOnDate, dk, () => new Map<string, number>());
    dp.set(e.parkId, (dp.get(e.parkId) ?? 0) + 1);
  }

  // Single pass: build park totals, per-date breakdowns, and member stats
  const parkStats = new Map<string, Tally>();
  const dateMap = new Map<
    string,
    { overall: Tally; byPark: Map<string, Tally> }
  >();
  const memberStats = new Map<
    string,
    { name: string; parkId: string | null; marked: number; present: number; late: number }
  >();

  for (const r of attendanceRecords) {
    const { parkId: recParkId, date } = r.event;
    const isPresent = r.status === "present";
    const isLate = r.status === "late";

    // Park totals (present/late only — total comes from member count × events)
    const park = getOrInit(parkStats, recParkId, TALLY_INIT);
    if (isPresent) park.present++;
    if (isLate) park.late++;

    // Per-date breakdown
    const dateKey = new Date(date).toISOString().slice(0, 10);
    const dayBucket = getOrInit(dateMap, dateKey, () => ({
      overall: TALLY_INIT(),
      byPark: new Map(),
    }));
    if (isPresent) dayBucket.overall.present++;
    if (isLate) dayBucket.overall.late++;

    const dayPark = getOrInit(dayBucket.byPark, recParkId, TALLY_INIT);
    if (isPresent) dayPark.present++;
    if (isLate) dayPark.late++;

    // Member stats (for top performers)
    if (r.memberId) {
      const ms = getOrInit(memberStats, r.memberId, () => ({
        name: r.member?.name ?? "Unknown",
        parkId: r.member?.parkId ?? null,
        marked: 0,
        present: 0,
        late: 0,
      }));
      ms.marked++;
      if (isPresent) ms.present++;
      if (isLate) ms.late++;
    }
  }

  // Park comparison: denominator = memberCount × completedEventCount
  const parkComparison = parks.map((p) => {
    const stats = parkStats.get(p.id) ?? TALLY_INIT();
    const mc = memberCountByPark.get(p.id) ?? 0;
    const ec = eventCountByPark.get(p.id) ?? 0;
    const total = mc * ec;
    return {
      name: p.name,
      rate: attendanceRate(stats.present, stats.late, total),
      total,
      present: stats.present,
    };
  });

  // Trend data: use completed events for denominator per date
  const allDateKeys = new Set([...dateMap.keys(), ...eventsOnDate.keys()]);
  const trendData = Array.from(allDateKeys)
    .sort()
    .map((dateKey) => {
      const bucket = dateMap.get(dateKey);
      const dateParks = eventsOnDate.get(dateKey);

      let overallTotal = 0;
      if (dateParks) {
        for (const [pId, ec] of dateParks) {
          overallTotal += (memberCountByPark.get(pId) ?? 0) * ec;
        }
      }

      const d = new Date(dateKey + "T00:00:00");
      const label = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const row: Record<string, string | number> = {
        date: label,
        overall: attendanceRate(bucket?.overall.present ?? 0, bucket?.overall.late ?? 0, overallTotal),
      };

      if (dateParks) {
        for (const [pId, ec] of dateParks) {
          const parkTotal = (memberCountByPark.get(pId) ?? 0) * ec;
          const parkBucket = bucket?.byPark.get(pId);
          row[pId] = attendanceRate(parkBucket?.present ?? 0, parkBucket?.late ?? 0, parkTotal);
        }
      }

      return row;
    });

  const parkNames = Object.fromEntries(parks.map((p) => [p.id, p.name]));

  // Top performers: denominator = completed events in their park
  const byPark = new Map<string, TopPerformer[]>();
  for (const [, ms] of memberStats) {
    if (ms.marked < MIN_RECORDS_FOR_TOP || !ms.parkId) continue;
    const total = eventCountByPark.get(ms.parkId) ?? 0;
    if (total === 0) continue;
    const list = getOrInit(byPark, ms.parkId, () => [] as TopPerformer[]);
    list.push({
      name: ms.name,
      parkName: parkNames[ms.parkId] ?? ms.parkId,
      parkId: ms.parkId,
      rate: attendanceRate(ms.present, ms.late, total),
      total,
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
