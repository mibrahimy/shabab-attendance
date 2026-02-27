"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import EventCard from "@/components/events/EventCard";
import AttendanceList from "@/components/attendance/AttendanceList";
import AttendanceReport from "@/components/attendance/AttendanceReport";
import { EVENT_TYPES } from "@/lib/utils";
import type { EventType } from "@/lib/utils";
import type { AttendanceSummary } from "@/types";

interface EventData {
  id: string;
  name: string;
  type: string;
  date: Date;
  startTime: string | null;
  endTime: string | null;
  status: string;
  isRecurring: boolean;
  park: { id: string; name: string };
  _count: { attendances: number };
}

interface MemberData {
  id: string;
  name: string;
  positionLabel: string;
  classAssignment: string | null;
}

interface ReportData {
  records: {
    id: string;
    status: string;
    member: { id: string; name: string; classAssignment: string | null };
    markedBy?: { name: string } | null;
  }[];
  summary: AttendanceSummary;
}

interface AttendanceClientProps {
  events: EventData[];
  initialEventId?: string;
}

export default function AttendanceClient({ events, initialEventId }: AttendanceClientProps) {
  const [selectedEventId, setSelectedEventId] = useState(initialEventId || "");
  const [tab, setTab] = useState<"mark" | "report">("mark");
  const [members, setMembers] = useState<MemberData[]>([]);
  const [existing, setExisting] = useState<{ memberId: string; status: string }[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
  const [parkFilter, setParkFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const parks = useMemo(() => {
    const seen = new Map<string, string>();
    for (const e of events) {
      if (!seen.has(e.park.id)) seen.set(e.park.id, e.park.name);
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filter !== "all" && e.status !== filter) return false;
      if (parkFilter && e.park.id !== parkFilter) return false;
      if (typeFilter && e.type !== typeFilter) return false;
      return true;
    });
  }, [events, filter, parkFilter, typeFilter]);

  const loadData = useCallback(async () => {
    if (!selectedEventId || !selectedEvent) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/attendance?eventId=${selectedEventId}`);
      if (!res.ok) throw new Error("Failed to load attendance data");
      const data = await res.json();
      setMembers(data.members);
      setExisting(data.existing);
      setReport(data.report);
      setWarning(data.warning || null);
    } catch {
      setError("Failed to load attendance data. Please check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }, [selectedEventId, selectedEvent]);

  useEffect(() => {
    if (selectedEventId) {
      loadData();
    }
  }, [selectedEventId, loadData]);

  function handleBack() {
    setSelectedEventId("");
    setMembers([]);
    setExisting([]);
    setReport(null);
    setError(null);
    setWarning(null);
    setTab("mark");
  }

  // --- Event selected: show attendance marking / report ---
  if (selectedEventId && selectedEvent) {
    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={handleBack}
            className="p-2 -ml-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">
              Attendance
            </h1>
            <p className="text-sm text-gray-500">{selectedEvent.name}</p>
          </div>
        </div>

        {warning && (
          <Card className="mb-4 border-amber-200 bg-amber-50">
            <p className="text-sm text-amber-800">{warning}</p>
          </Card>
        )}

        {error && (
          <Card className="mb-4 border-red-200 bg-red-50">
            <div className="flex items-center justify-between">
              <p className="text-sm text-red-800">{error}</p>
              <button
                onClick={loadData}
                className="ml-4 px-3 py-1.5 text-sm font-medium text-red-700 bg-red-100 rounded-lg hover:bg-red-200 transition-colors shrink-0"
              >
                Retry
              </button>
            </div>
          </Card>
        )}

        {loading && (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {!loading && !error && (
          <>
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setTab("mark")}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] lg:min-h-0 transition-colors ${
                  tab === "mark"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Mark Attendance
              </button>
              <button
                onClick={() => setTab("report")}
                className={`px-4 py-2 rounded-lg text-sm font-medium min-h-[44px] lg:min-h-0 transition-colors ${
                  tab === "report"
                    ? "bg-blue-50 text-blue-700"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                Report
              </button>
            </div>

            {tab === "mark" ? (
              <Card>
                {members.length === 0 ? (
                  <EmptyState
                    title="No members in this park"
                    description="Add team members to this event's park first."
                  />
                ) : (
                  <AttendanceList
                    eventId={selectedEventId}
                    members={members}
                    existing={existing}
                    onDone={loadData}
                  />
                )}
              </Card>
            ) : (
              report && (
                <AttendanceReport
                  records={report.records}
                  summary={report.summary}
                />
              )
            )}
          </>
        )}
      </div>
    );
  }

  // --- No event selected: show event card grid ---
  return (
    <div>
      <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">
        Attendance
      </h1>

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(["all", "scheduled", "completed"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-[44px] lg:min-h-0 transition-colors ${
              filter === f
                ? "bg-blue-50 text-blue-700"
                : "text-gray-500 hover:bg-gray-100"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}

        <div className="flex gap-2 ml-auto">
          <select
            value={parkFilter}
            onChange={(e) => setParkFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Parks</option>
            {parks.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          >
            <option value="">All Types</option>
            {Object.entries(EVENT_TYPES).map(([key, val]) => (
              <option key={key} value={key}>{val.label}</option>
            ))}
          </select>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState
          title="No events found"
          description={filter === "all"
            ? "No events available. Create events first."
            : `No ${filter} events.`}
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      ) : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => setSelectedEventId(event.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
