import type { User, Member, Event, Attendance, Park, City } from "@prisma/client";

export type SafeUser = Omit<User, "passwordHash">;

export type MemberWithChildren = Member & {
  children: MemberWithChildren[];
  user?: { id: string; email: string } | null;
  park?: Park | null;
};

export type EventWithPark = Event & {
  park: Park;
  _count?: {
    attendances: number;
  };
};

export type AttendanceWithDetails = Attendance & {
  event: Event;
  member: Member;
  markedBy?: SafeUser | null;
};

export type ParkWithCity = Park & {
  city: City;
};

export type DashboardStats = {
  totalMembers: number;
  activeEvents: number;
  attendanceRate: number;
  totalParks: number;
};

/** Shared lightweight types used across multiple client components */

export type ParkOption = {
  id: string;
  name: string;
};

export type MemberOption = {
  id: string;
  name: string;
  positionLabel: string;
};

export type AttendanceStatus = "present" | "absent" | "excused";

export type BadgeColor = "blue" | "green" | "amber" | "purple" | "indigo" | "orange" | "pink" | "slate" | "red" | "gray";

export type AttendanceSummary = {
  total: number;
  present: number;
  absent: number;
  excused: number;
  rate: number;
};
