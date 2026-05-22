"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  LabelList,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts";
import Card from "@/components/ui/Card";

interface ParkComparison {
  name: string;
  rate: number;
  total: number;
  present: number;
}

type TrendRow = Record<string, string | number>;

interface TopPerformer {
  name: string;
  parkName: string;
  parkId: string;
  rate: number;
  total: number;
  present: number;
  late: number;
}

interface AnalyticsClientProps {
  parkComparison: ParkComparison[];
  trendData: TrendRow[];
  parkNames: Record<string, string>;
  topPerformers: TopPerformer[];
}

const PARK_COLORS = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
];

const TOOLTIP_STYLE = {
  borderRadius: "8px",
  border: "1px solid #e5e7eb",
  fontSize: "13px",
};

const AXIS_TICK = { fontSize: 12, fill: "#6b7280" };

const PERCENT_Y_AXIS = {
  domain: [0, 100] as [number, number],
  tick: AXIS_TICK,
  tickLine: false,
  tickFormatter: (v: number) => `${v}%`,
};

function rateColor(r: number): string {
  if (r >= 80) return "text-green-700";
  if (r >= 50) return "text-amber-600";
  return "text-red-600";
}

export default function AnalyticsClient({
  parkComparison,
  trendData,
  parkNames,
  topPerformers,
}: AnalyticsClientProps) {
  const parkIds = Object.keys(parkNames);
  const [selectedPark, setSelectedPark] = useState<string | null>(null);

  // Weighted overall rate
  const totalSlots = parkComparison.reduce((s, p) => s + p.total, 0);
  const overallRate =
    totalSlots > 0
      ? Math.round(
          parkComparison.reduce((s, p) => s + p.rate * p.total, 0) / totalSlots
        )
      : 0;
  const bestPark =
    parkComparison.length > 0
      ? parkComparison.reduce((a, b) => (a.rate >= b.rate ? a : b))
      : null;
  const activeParks = parkComparison.filter((p) => p.total > 0).length;

  function resolveParkName(key: string): string {
    return key === "overall" ? "Overall" : parkNames[key] || key;
  }

  return (
    <div className="space-y-6">
      {/* ── At-a-glance stats ── */}
      {parkComparison.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className={`text-2xl font-semibold ${rateColor(overallRate)}`}>
              {overallRate}%
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Overall</div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div
              className={`text-xl font-semibold leading-tight ${
                bestPark ? rateColor(bestPark.rate) : "text-gray-900"
              }`}
            >
              {bestPark ? `${bestPark.rate}%` : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              {bestPark?.name ?? "—"}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
            <div className="text-2xl font-semibold text-gray-900">
              {activeParks}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">Parks</div>
          </div>
        </div>
      )}

      {/* ── Horizontal bar chart ── */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Attendance Rate by Park
        </h2>
        {parkComparison.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No attendance data yet
          </p>
        ) : (
          <div
            style={{ height: Math.max(200, parkComparison.length * 52) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={parkComparison}
                layout="vertical"
                margin={{ top: 4, right: 40, left: 0, bottom: 4 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="#e5e7eb"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  tick={AXIS_TICK}
                  tickLine={false}
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                  width={88}
                />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Rate"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar
                  dataKey="rate"
                  fill="var(--accent)"
                  radius={[0, 4, 4, 0]}
                >
                  <LabelList
                    dataKey="rate"
                    position="right"
                    formatter={(v: unknown) => `${v}%`}
                    style={{ fontSize: 12, fill: "#6b7280" }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ── Trend line chart with park toggle ── */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-3">
          Attendance Trends
        </h2>

        {/* Park selector pills */}
        {parkIds.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-4 pb-0.5">
            <button
              onClick={() => setSelectedPark(null)}
              className={`shrink-0 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                selectedPark === null
                  ? "bg-[var(--accent-light)] text-[var(--accent-text)]"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              Overall
            </button>
            {parkIds.map((id, i) => (
              <button
                key={id}
                onClick={() =>
                  setSelectedPark(selectedPark === id ? null : id)
                }
                className={`shrink-0 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  selectedPark === id
                    ? "bg-[var(--accent-light)] text-[var(--accent-text)]"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
                style={
                  selectedPark === id
                    ? {}
                    : { borderLeft: `3px solid ${PARK_COLORS[i % PARK_COLORS.length]}` }
                }
              >
                {parkNames[id]}
              </button>
            ))}
          </div>
        )}

        {trendData.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No trend data available
          </p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={trendData}
                margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ ...AXIS_TICK, fontSize: 11 }}
                  tickLine={false}
                />
                <YAxis {...PERCENT_Y_AXIS} />
                <Tooltip
                  formatter={(value, name) => [
                    `${value}%`,
                    resolveParkName(name as string),
                  ]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="#111827"
                  strokeWidth={2.5}
                  dot={false}
                  name="overall"
                />
                {selectedPark && (
                  <Line
                    type="monotone"
                    dataKey={selectedPark}
                    stroke={(() => {
                      const idx = parkIds.indexOf(selectedPark);
                      return PARK_COLORS[((idx % PARK_COLORS.length) + PARK_COLORS.length) % PARK_COLORS.length];
                    })()}
                    strokeWidth={2}
                    dot={false}
                    connectNulls
                    name={selectedPark}
                  />
                )}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* ── Top Performers — two-line rows ── */}
      {topPerformers.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-gray-900 mb-4">
            Top Performers by Zone
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.entries(
              topPerformers.reduce<Record<string, TopPerformer[]>>(
                (acc, p) => {
                  (acc[p.parkName] ??= []).push(p);
                  return acc;
                },
                {}
              )
            ).map(([parkName, members]) => (
              <div key={parkName}>
                <h3 className="text-sm font-medium text-gray-500 mb-3">
                  {parkName}
                </h3>
                <div className="space-y-3">
                  {members.map((m, i) => (
                    <div
                      key={`${m.name}-${i}`}
                      className="flex items-center gap-3"
                    >
                      <span className="w-5 text-right text-gray-400 font-medium text-sm shrink-0">
                        {i + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {m.name}
                        </div>
                        <div className="text-xs text-gray-400">
                          {m.present + m.late}/{m.total} sessions
                        </div>
                      </div>
                      <span
                        className={`font-semibold text-sm shrink-0 ${rateColor(m.rate)}`}
                      >
                        {m.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
