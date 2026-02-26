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

  function toggleStatus(memberId: string) {
    setStatuses((prev) => {
      const current = prev[memberId];
      const next: DisplayStatus =
        current === "unmarked" ? "present" :
        current === "present" ? "absent" :
        current === "absent" ? "excused" :
        "present";
      return { ...prev, [memberId]: next };
    });
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
      initialStatusesRef.current = { ...statuses };
      onDone();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;
  const absentCount = Object.values(statuses).filter((s) => s === "absent").length;
  const excusedCount = Object.values(statuses).filter((s) => s === "excused").length;
  const unmarkedCount = Object.values(statuses).filter((s) => s === "unmarked").length;

  const statusConfig: Record<DisplayStatus, { bg: string; text: string; label: string }> = {
    present: { bg: "bg-green-100", text: "text-green-700", label: "Present" },
    absent: { bg: "bg-red-100", text: "text-red-700", label: "Absent" },
    excused: { bg: "bg-amber-100", text: "text-amber-700", label: "Excused" },
    unmarked: { bg: "bg-gray-100", text: "text-gray-500", label: "Unmarked" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="text-sm text-gray-600 space-x-2">
          <span className="text-green-700">{presentCount}P</span>
          <span className="text-red-700">{absentCount}A</span>
          <span className="text-amber-700">{excusedCount}E</span>
          {unmarkedCount > 0 && (
            <span className="text-gray-500">{unmarkedCount} unmarked</span>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={markAllPresent}>
          Mark All Present
        </Button>
      </div>

      <div className="space-y-1">
        {members.map((member) => {
          const status = statuses[member.id];
          const config = statusConfig[status];
          return (
            <button
              key={member.id}
              type="button"
              onClick={() => toggleStatus(member.id)}
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-all duration-150 min-h-[52px] active:scale-[0.98]"
            >
              <div className="w-9 h-9 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
                {getInitials(member.name)}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-medium text-gray-900">{member.name}</p>
                {member.classAssignment && (
                  <p className="text-xs text-gray-500">{member.classAssignment}</p>
                )}
              </div>
              <span
                className={`px-3 py-1 rounded-full text-xs font-medium min-w-[72px] text-center transition-colors duration-150 ${config.bg} ${config.text}`}
              >
                {config.label}
              </span>
            </button>
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
