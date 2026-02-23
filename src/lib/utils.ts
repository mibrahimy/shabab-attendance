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

export function getAttendanceStatusColor(status: string): "green" | "amber" | "red" {
  if (status === "present") return "green";
  if (status === "excused") return "amber";
  return "red";
}

export function getEventStatusColor(status: string): "blue" | "green" | "red" {
  if (status === "scheduled") return "blue";
  if (status === "completed") return "green";
  return "red";
}

export function computeAttendanceSummary(records: { status: string }[]) {
  const total = records.length;
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;
  const excused = records.filter((r) => r.status === "excused").length;
  return {
    total,
    present,
    absent,
    excused,
    rate: total > 0 ? Math.round((present / total) * 100) : 0,
  };
}
