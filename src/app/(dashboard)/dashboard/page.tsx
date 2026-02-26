import { Suspense } from "react";
import Link from "next/link";
import { prisma } from "@/lib/db";
import StatCard from "@/components/dashboard/StatCard";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import DeniedNotice from "@/components/dashboard/DeniedNotice";
import { EVENT_TYPES, formatDate, getAttendanceStatusColor } from "@/lib/utils";
import type { EventType } from "@/lib/utils";
import type { BadgeColor } from "@/types";

export default async function DashboardPage() {
  const [totalMembers, totalParks, activeEvents, recentAttendance, upcomingEvents] =
    await Promise.all([
      prisma.member.count(),
      prisma.park.count(),
      prisma.event.count({ where: { status: "scheduled" } }),
      prisma.attendance.findMany({
        take: 10,
        orderBy: { createdAt: "desc" },
        include: { member: true, event: true, markedBy: true },
      }),
      prisma.event.findMany({
        where: {
          date: { gte: new Date() },
          status: "scheduled",
        },
        take: 5,
        orderBy: { date: "asc" },
        include: { park: true },
      }),
    ]);

  // Calculate attendance rate this month
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const [totalRecords, presentRecords] = await Promise.all([
    prisma.attendance.count({
      where: { createdAt: { gte: startOfMonth } },
    }),
    prisma.attendance.count({
      where: { createdAt: { gte: startOfMonth }, status: "present" },
    }),
  ]);

  const attendanceRate = totalRecords > 0 ? Math.round((presentRecords / totalRecords) * 100) : 0;

  return (
    <div>
      <Suspense><DeniedNotice /></Suspense>
      <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">
        Dashboard
      </h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
        <StatCard
          label="Total Members"
          value={totalMembers}
          href="/team"
          iconColor="text-blue-600 bg-blue-50"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          }
        />
        <StatCard
          label="Active Events"
          value={activeEvents}
          href="/events"
          iconColor="text-amber-600 bg-amber-50"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
        />
        <StatCard
          label="Attendance Rate"
          value={`${attendanceRate}%`}
          trend="This month"
          href="/attendance"
          iconColor="text-green-600 bg-green-50"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Parks"
          value={totalParks}
          href="/parks"
          iconColor="text-purple-600 bg-purple-50"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          }
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 lg:gap-6">
        <Card>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-gray-900">
              Upcoming Events
            </h2>
            <Link href="/events" className="text-xs text-blue-600 hover:text-blue-800">
              View all
            </Link>
          </div>
          {upcomingEvents.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No upcoming events</p>
          ) : (
            <div className="space-y-3">
              {upcomingEvents.map((event) => {
                const typeInfo = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.custom;
                return (
                  <Link
                    key={event.id}
                    href={`/attendance?eventId=${event.id}`}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0 hover:bg-gray-50 -mx-2 px-2 rounded-lg transition-colors"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {event.name}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatDate(event.date)} &middot; {event.park.name}
                      </p>
                    </div>
                    <Badge color={typeInfo.color as BadgeColor}>
                      {typeInfo.label}
                    </Badge>
                  </Link>
                );
              })}
            </div>
          )}
        </Card>

        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Recent Activity
          </h2>
          {recentAttendance.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">No recent activity</p>
          ) : (
            <div className="space-y-3">
              {recentAttendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {record.member.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {record.event.name}
                    </p>
                  </div>
                  <Badge color={getAttendanceStatusColor(record.status)}>
                    {record.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
