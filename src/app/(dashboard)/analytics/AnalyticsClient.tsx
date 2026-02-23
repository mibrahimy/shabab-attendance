"use client";

import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import Card from "@/components/ui/Card";

interface ParkComparison {
  name: string;
  rate: number;
  total: number;
  present: number;
}

type TrendRow = Record<string, string | number>;

interface AnalyticsClientProps {
  parkComparison: ParkComparison[];
  trendData: TrendRow[];
  parkNames: Record<string, string>;
}

const TIME_RANGES = [
  { label: "4 Weeks", weeks: 4 },
  { label: "3 Months", weeks: 13 },
  { label: "All Time", weeks: 0 },
] as const;

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

const CHART_MARGIN = { top: 8, right: 16, left: 0, bottom: 0 };

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

export default function AnalyticsClient({
  parkComparison,
  trendData,
  parkNames,
}: AnalyticsClientProps) {
  const [rangeIndex, setRangeIndex] = useState(0);

  const selectedRange = TIME_RANGES[rangeIndex];
  const filteredTrend =
    selectedRange.weeks === 0
      ? trendData
      : trendData.slice(-selectedRange.weeks);

  const parkIds = Object.keys(parkNames);

  function resolveParkName(key: string): string {
    return key === "overall" ? "Overall" : parkNames[key] || key;
  }

  return (
    <div className="space-y-6">
      {/* Bar Chart -- Park Comparison */}
      <Card>
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Attendance Rate by Park
        </h2>
        {parkComparison.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No attendance data yet
          </p>
        ) : (
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={parkComparison} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="name"
                  tick={AXIS_TICK}
                  tickLine={false}
                />
                <YAxis {...PERCENT_Y_AXIS} />
                <Tooltip
                  formatter={(value) => [`${value}%`, "Rate"]}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Line Chart -- Trends */}
      <Card>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-gray-900">
            Attendance Trends
          </h2>
          <div className="flex gap-1">
            {TIME_RANGES.map((range, i) => (
              <button
                key={range.label}
                onClick={() => setRangeIndex(i)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  rangeIndex === i
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>
        {filteredTrend.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No trend data available
          </p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={filteredTrend} margin={CHART_MARGIN}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="week"
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
                <Legend formatter={resolveParkName} />
                <Line
                  type="monotone"
                  dataKey="overall"
                  stroke="#111827"
                  strokeWidth={2.5}
                  dot={false}
                />
                {parkIds.map((parkId, i) => (
                  <Line
                    key={parkId}
                    type="monotone"
                    dataKey={parkId}
                    stroke={PARK_COLORS[i % PARK_COLORS.length]}
                    strokeWidth={1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>
    </div>
  );
}
