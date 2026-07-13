// Shared lightweight types used across client components. (The v1 Prisma-derived
// types were removed with the v1 surface; v2 uses its own domain types.)

export type ParkOption = {
  id: string;
  name: string;
};

export type MemberOption = {
  id: string;
  name: string;
  positionLabel: string;
};

export type { AttendanceStatus } from "@/lib/attendance-status";

export type BadgeColor = "blue" | "green" | "amber" | "purple" | "indigo" | "orange" | "pink" | "slate" | "red" | "gray";

export type AttendanceSummary = {
  total: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  rate: number;
};
