"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { markAttendance } from "@/actions/attendance";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getInitials } from "@/lib/utils";
import type { AttendanceStatus } from "@/types";

type DisplayStatus = AttendanceStatus | "unmarked";

interface AttendanceMember {
  id: string;
  name: string;
  positionLabel: string;
  classAssignment: string | null;
}

interface ExistingRecord {
  memberId: string;
  status: string;
}

interface AttendanceListProps {
  eventId: string;
  members: AttendanceMember[];
  existing: ExistingRecord[];
  onDone: () => void;
}

export default function AttendanceList({
  eventId,
  members,
  existing,
  onDone,
}: AttendanceListProps) {
  const [statuses, setStatuses] = useState<Record<string, DisplayStatus>>(() => {
    const initial: Record<string, DisplayStatus> = {};
    for (const m of members) {
      const ex = existing.find((e) => e.memberId === m.id);
      initial[m.id] = (ex?.status as DisplayStatus) || "unmarked";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();
  const initialStatusesRef = useRef(statuses);

  // Track if there are unsaved changes
  const hasChanges = Object.keys(statuses).some(
    (id) => statuses[id] !== initialStatusesRef.current[id]
  );

  // Warn before navigating away with unsaved changes
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (hasChanges) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasChanges]);

  function setStatus(memberId: string, newStatus: DisplayStatus) {
    setStatuses((prev) => ({
      ...prev,
      [memberId]: prev[memberId] === newStatus ? "unmarked" : newStatus,
    }));
  }

  const markAllPresent = useCallback(() => {
    const updated: Record<string, DisplayStatus> = {};
    for (const m of members) {
      updated[m.id] = "present";
    }
    setStatuses(updated);
  }, [members]);

  async function handleSave() {
    // Only save members with an explicit status (not unmarked)
    const markedEntries = Object.entries(statuses).filter(
      ([, status]) => status !== "unmarked"
    );

    if (markedEntries.length === 0) {
      toast("No attendance marked yet. Tap on members to set their status.", "error");
      return;
    }

    // Snapshot what we're about to save before the async call so the ref
    // reflects exactly what reached the server, not whatever state the user
    // may have set on chips while the request was in-flight.
    const savedSnapshot = { ...statuses };
    setSaving(true);

    try {
      const records = markedEntries.map(([memberId, status]) => ({
        memberId,
        status: status as AttendanceStatus,
      }));
      const result = await markAttendance(eventId, records);

      if (result?.error) {
        toast(result.error, "error");
        setSaving(false);
        return;
      }

      toast("Attendance saved successfully");
      initialStatusesRef.current = savedSnapshot;
      onDone();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;
  const lateCount = Object.values(statuses).filter((s) => s === "late").length;
  const absentCount = Object.values(statuses).filter((s) => s === "absent").length;
  const excusedCount = Object.values(statuses).filter((s) => s === "excused").length;
  const unmarkedCount = Object.values(statuses).filter((s) => s === "unmarked").length;

  const STATUS_CHIPS: Array<{ key: Exclude<DisplayStatus, "unmarked">; label: string; activeClass: string; inactiveClass: string }> = [
    { key: "present", label: "P", activeClass: "bg-green-500 text-white", inactiveClass: "bg-gray-100 text-gray-400" },
    { key: "late",    label: "L", activeClass: "bg-amber-500 text-white", inactiveClass: "bg-gray-100 text-gray-400" },
    { key: "absent",  label: "A", activeClass: "bg-red-500 text-white",   inactiveClass: "bg-gray-100 text-gray-400" },
    { key: "excused", label: "E", activeClass: "bg-yellow-500 text-white", inactiveClass: "bg-gray-100 text-gray-400" },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          {presentCount > 0 && (
            <span className="text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">{presentCount} Present</span>
          )}
          {lateCount > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-medium px-2 py-0.5 rounded-full">{lateCount} Late</span>
          )}
          {absentCount > 0 && (
            <span className="text-xs bg-red-100 text-red-700 font-medium px-2 py-0.5 rounded-full">{absentCount} Absent</span>
          )}
          {excusedCount > 0 && (
            <span className="text-xs bg-yellow-100 text-yellow-700 font-medium px-2 py-0.5 rounded-full">{excusedCount} Excused</span>
          )}
          {unmarkedCount > 0 && (
            <span className="text-xs text-gray-400 font-medium">{unmarkedCount} unmarked</span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={markAllPresent}>
          Mark All Present
        </Button>
      </div>

      <div className="space-y-1">
        {members.map((member) => {
          const status = statuses[member.id];
          return (
            <div
              key={member.id}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-md min-h-[52px]"
            >
              <div className="w-8 h-8 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-xs font-medium shrink-0">
                {getInitials(member.name)}
              </div>
              <div className="flex-1 text-left min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{member.name}</p>
                <p className="text-xs text-gray-500 truncate">
                  {member.positionLabel}
                  {member.classAssignment && ` · ${member.classAssignment}`}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {STATUS_CHIPS.map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    aria-label={chip.key}
                    onClick={() => setStatus(member.id, chip.key)}
                    className={`w-8 h-8 rounded-md text-xs font-semibold transition-colors duration-100 active:scale-90 ${
                      status === chip.key ? chip.activeClass : chip.inactiveClass
                    }`}
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : `Save Attendance (${members.length - unmarkedCount}/${members.length})`}
        </Button>
      </div>
    </div>
  );
}
