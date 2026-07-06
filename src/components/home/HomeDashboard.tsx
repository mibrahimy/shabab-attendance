"use client";

// The authed landing. For a city admin it's a real dashboard — the city's shape
// (node counts per level + people) and quick actions into the surfaces they use.
// Superadmins get the cities entry; anyone else gets what their grants allow.

import Link from "next/link";
import { useTranslation } from "react-i18next";
import Badge from "@/components/ui/Badge";
import { levelColor } from "@/lib/level-colors";
import type { LevelCount } from "@/lib/city-summary";

type Summary = { city: { id: string; name: string }; levels: LevelCount[]; peopleCount: number };

function QuickCard({ href, title, desc }: { href: string; title: string; desc: string }) {
  return (
    <Link
      href={href}
      className="block rounded-2xl border border-gray-200 bg-white p-4 transition hover:border-[#2f55ea]/40 hover:bg-[#2f55ea]/[0.02]"
    >
      <div className="flex items-center justify-between">
        <span className="font-medium text-gray-900">{title}</span>
        <span className="text-gray-300" aria-hidden>
          ›
        </span>
      </div>
      <p className="mt-1 text-sm text-gray-500">{desc}</p>
    </Link>
  );
}

export function HomeDashboard({
  summary,
  cityId,
  isSuperadmin,
  canMarkAttendance,
}: {
  summary: Summary | null;
  cityId: string | null;
  isSuperadmin: boolean;
  canMarkAttendance: boolean;
}) {
  const { t } = useTranslation(["home", "common"]);

  return (
    <div className="space-y-6">
      {summary && cityId ? (
        <>
          <div>
            <p className="text-sm text-gray-500">{t("greeting")}</p>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
              {summary.city.name}
            </h1>
          </div>

          {/* City shape: node counts per level + people */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {summary.levels.map((l) => (
              <div key={l.key} className="rounded-2xl border border-gray-200 bg-white p-4">
                <div className="font-mono text-2xl font-semibold text-gray-900">{l.count}</div>
                <div className="mt-1">
                  <Badge color={levelColor(l.key)}>{l.label}</Badge>
                </div>
              </div>
            ))}
            <div className="rounded-2xl border border-gray-200 bg-white p-4">
              <div className="font-mono text-2xl font-semibold text-gray-900">
                {summary.peopleCount}
              </div>
              <div className="mt-1 text-xs font-medium text-gray-500">{t("people")}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <QuickCard href={`/hierarchy/${cityId}`} title={t("cards.hierarchy")} desc={t("cards.hierarchyDesc")} />
            <QuickCard href={`/roles/${cityId}`} title={t("cards.roles")} desc={t("cards.rolesDesc")} />
            <QuickCard href="/mark" title={t("cards.attendance")} desc={t("cards.attendanceDesc")} />
          </div>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t("greeting")}</h1>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {isSuperadmin && (
              <QuickCard href="/cities" title={t("cards.cities")} desc={t("cards.citiesDesc")} />
            )}
            {canMarkAttendance && (
              <QuickCard href="/mark" title={t("cards.attendance")} desc={t("cards.attendanceDesc")} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
