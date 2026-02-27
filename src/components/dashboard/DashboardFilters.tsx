"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useCallback } from "react";
import { EVENT_TYPES } from "@/lib/utils";

interface DashboardFiltersProps {
  cities: { id: string; name: string }[];
  parks: { id: string; name: string; cityId: string }[];
  defaultRange?: string;
}

const DATE_RANGES = [
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "3_months", label: "3 Months" },
  { key: "6_months", label: "6 Months" },
  { key: "this_year", label: "This Year" },
  { key: "all", label: "All Time" },
] as const;

const selectClass =
  "rounded-lg border border-gray-300 px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

export default function DashboardFilters({
  cities,
  parks,
  defaultRange = "this_month",
}: DashboardFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const cityId = searchParams.get("city") ?? "";
  const parkId = searchParams.get("park") ?? "";
  const eventType = searchParams.get("type") ?? "";
  const range = searchParams.get("range") ?? defaultRange;

  const updateParams = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value);
        } else {
          params.delete(key);
        }
      }
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [searchParams, router, pathname]
  );

  const filteredParks = cityId
    ? parks.filter((p) => p.cityId === cityId)
    : parks;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* City */}
      <select
        value={cityId}
        onChange={(e) => {
          const newCity = e.target.value;
          // Clearing city also clears park
          if (!newCity) {
            updateParams({ city: "", park: "" });
          } else {
            // If current park doesn't belong to new city, clear it
            const parkStillValid = parks.some(
              (p) => p.id === parkId && p.cityId === newCity
            );
            updateParams({
              city: newCity,
              park: parkStillValid ? parkId : "",
            });
          }
        }}
        className={selectClass}
      >
        <option value="">All Cities</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      {/* Park */}
      <select
        value={parkId}
        onChange={(e) => {
          const newPark = e.target.value;
          if (newPark) {
            // Auto-select city when park is selected
            const parkCity = parks.find((p) => p.id === newPark)?.cityId ?? "";
            updateParams({ park: newPark, city: parkCity });
          } else {
            updateParams({ park: "" });
          }
        }}
        className={selectClass}
      >
        <option value="">All Parks</option>
        {filteredParks.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>

      {/* Event Type */}
      <select
        value={eventType}
        onChange={(e) => updateParams({ type: e.target.value })}
        className={selectClass}
      >
        <option value="">All Event Types</option>
        {Object.entries(EVENT_TYPES).map(([key, { label }]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>

      {/* Date Range pills */}
      <div className="flex gap-1">
        {DATE_RANGES.map((r) => (
          <button
            key={r.key}
            onClick={() =>
              updateParams({ range: r.key === defaultRange ? "" : r.key })
            }
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
              range === r.key
                ? "bg-blue-100 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
