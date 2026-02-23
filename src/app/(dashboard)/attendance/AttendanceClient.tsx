"use client";

import { useState, useEffect, useCallback } from "react";
import Card from "@/components/ui/Card";
import EmptyState from "@/components/ui/EmptyState";
import AttendanceList from "@/components/attendance/AttendanceList";
import AttendanceReport from "@/components/attendance/AttendanceReport";
import { formatDate, EVENT_TYPES } from "@/lib/utils";
import type { EventType } from "@/lib/utils";
import type { ParkOption, AttendanceSummary } from "@/types";

interface EventData {
  id: string;
  name: string;
  type: string;
  date: Date;
  status: string;
  park: ParkOption;
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
}

export default function AttendanceClient({ events }: AttendanceClientProps) {
  const [selectedEventId, setSelectedEventId] = useState("");
  const [tab, setTab] = useState<"mark" | "report">("mark");
  const [members, setMembers] = useState<MemberData[]>([]);
  const [existing, setExisting] = useState<{ memberId: string; status: string }[]>([]);
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);

  const selectedEvent = events.find((e) => e.id === selectedEventId);

  const loadData = useCallback(async () => {
    if (!selectedEventId || !selectedEvent) return;
    setLoading(true);

    const res = await fetch(`/api/attendance?eventId=${selectedEventId}`);
    const data = await res.json();
    setMembers(data.members);
    setExisting(data.existing);
    setReport(data.report);
    setWarning(data.warning || null);
    setLoading(false);
  }, [selectedEventId, selectedEvent]);

  useEffect(() => {
    if (selectedEventId) {
      loadData();
    }
  }, [selectedEventId, loadData]);

  return (
    <div>
      <h1 className="text-xl lg:text-2xl font-semibold text-gray-900 mb-6">
        Attendance
      </h1>

      <Card className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Event
        </label>
        <select
          value={selectedEventId}
          onChange={(e) => setSelectedEventId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">Choose an event...</option>
          {events.map((event) => {
            const typeInfo = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.custom;
            return (
              <option key={event.id} value={event.id}>
                {event.name} — {formatDate(event.date)} ({typeInfo.label})
              </option>
            );
          })}
        </select>
      </Card>

      {!selectedEventId && (
        <EmptyState
          title="Select an event"
          description="Choose an event above to mark attendance or view reports."
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
      )}

      {warning && (
        <Card className="mb-4 border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-800">{warning}</p>
        </Card>
      )}

      {selectedEventId && !loading && (
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

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  );
}
