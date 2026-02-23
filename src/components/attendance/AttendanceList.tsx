"use client";

import { useState } from "react";
import { markAttendance } from "@/actions/attendance";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { getInitials } from "@/lib/utils";
import type { AttendanceStatus } from "@/types";

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
  const [statuses, setStatuses] = useState<Record<string, AttendanceStatus>>(() => {
    const initial: Record<string, AttendanceStatus> = {};
    for (const m of members) {
      const ex = existing.find((e) => e.memberId === m.id);
      initial[m.id] = (ex?.status as AttendanceStatus) || "absent";
    }
    return initial;
  });
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  function toggleStatus(memberId: string) {
    setStatuses((prev) => {
      const current = prev[memberId];
      const next: AttendanceStatus =
        current === "absent" ? "present" : current === "present" ? "excused" : "absent";
      return { ...prev, [memberId]: next };
    });
  }

  function markAllPresent() {
    const updated: Record<string, AttendanceStatus> = {};
    for (const m of members) {
      updated[m.id] = "present";
    }
    setStatuses(updated);
  }

  async function handleSave() {
    setSaving(true);

    try {
      const records = Object.entries(statuses).map(([memberId, status]) => ({
        memberId,
        status,
      }));
      const result = await markAttendance(eventId, records);

      if (result?.error) {
        toast(result.error, "error");
        setSaving(false);
        return;
      }

      toast("Attendance saved successfully");
      onDone();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  const presentCount = Object.values(statuses).filter((s) => s === "present").length;

  const statusConfig: Record<AttendanceStatus, { bg: string; text: string; label: string }> = {
    present: { bg: "bg-green-100", text: "text-green-700", label: "Present" },
    absent: { bg: "bg-red-100", text: "text-red-700", label: "Absent" },
    excused: { bg: "bg-amber-100", text: "text-amber-700", label: "Excused" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-600">
          {presentCount}/{members.length} present
        </p>
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
              className="w-full flex items-center gap-3 px-3 py-3 rounded-lg hover:bg-gray-50 transition-colors min-h-[52px]"
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
                className={`px-3 py-1 rounded-full text-xs font-medium min-w-[72px] text-center ${config.bg} ${config.text}`}
              >
                {config.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mt-6 pt-4 border-t border-gray-200">
        <Button onClick={handleSave} disabled={saving} className="w-full">
          {saving ? "Saving..." : "Save Attendance"}
        </Button>
      </div>
    </div>
  );
}
