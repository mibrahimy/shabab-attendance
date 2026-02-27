"use client";

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
        <h2 className="text-base font-semibold text-gray-900 mb-4">
          Attendance Trends
        </h2>
        {trendData.length === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            No trend data available
          </p>
        ) : (
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={CHART_MARGIN}>
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

      {/* Top Performers by Zone */}
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
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  {parkName}
                </h3>
                <div className="space-y-1.5">
                  {members.map((m, i) => (
                    <div
                      key={`${m.name}-${i}`}
                      className="flex items-center gap-2 text-sm"
                    >
                      <span className="w-5 text-right text-gray-400 font-medium">
                        {i + 1}.
                      </span>
                      <span className="flex-1 truncate text-gray-900">
                        {m.name}
                      </span>
                      <span className="text-xs text-gray-500">
                        {m.present + m.late}/{m.total} sessions
                      </span>
                      <span
                        className={`font-semibold text-xs w-10 text-right ${rateColor(m.rate)}`}
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
