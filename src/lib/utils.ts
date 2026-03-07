import { type ClassValue, clsx } from "clsx";

export function cn(...inputs: ClassValue[]): string {
  return clsx(inputs);
}

export function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatTime(time: string): string {
  const [hours, minutes] = time.split(":");
  const h = parseInt(hours);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${minutes} ${ampm}`;
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export const EVENT_TYPES = {
  weekly_session: { label: "Weekly Session", color: "blue" },
  orientation: { label: "Orientation", color: "green" },
  interview: { label: "Interview", color: "amber" },
  mashwara: { label: "Mashwara", color: "purple" },
  islahi_majlis: { label: "Islahi Majlis", color: "indigo" },
  sports: { label: "Sports", color: "orange" },
  parent_meeting: { label: "Parent Meeting", color: "pink" },
  camp: { label: "Camp", color: "amber" },
  custom: { label: "Custom", color: "slate" },
} as const;

export type EventType = keyof typeof EVENT_TYPES;

export function getDateRangeStart(range: string): Date | null {
  const now = new Date();
  switch (range) {
    case "this_month": {
      const d = new Date(now.getFullYear(), now.getMonth(), 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "last_month": {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "3_months": {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "6_months": {
      const d = new Date();
      d.setMonth(d.getMonth() - 6);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "this_year": {
      const d = new Date(now.getFullYear(), 0, 1);
      d.setHours(0, 0, 0, 0);
      return d;
    }
    case "all":
    default:
      return null;
  }
}

export function getAttendanceStatusColor(status: string): "green" | "amber" | "red" {
  if (status === "present") return "green";
  if (status === "late") return "amber";
  if (status === "excused") return "amber";
  return "red";
}

export function getEventStatusColor(status: string): "blue" | "green" | "red" {
  if (status === "scheduled") return "blue";
  if (status === "completed") return "green";
  return "red";
}

export function attendanceRate(present: number, late: number, total: number): number {
  return total > 0 ? Math.round(((present + late) / total) * 100) : 0;
}

export function computeAttendanceSummary(records: { status: string }[], totalMembers?: number) {
  const total = totalMembers ?? records.length;
  const present = records.filter((r) => r.status === "present").length;
  const late = records.filter((r) => r.status === "late").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const excused = records.filter((r) => r.status === "excused").length;
  return {
    total,
    present,
    late,
    absent,
    excused,
    rate: attendanceRate(present, late, total),
  };
}
