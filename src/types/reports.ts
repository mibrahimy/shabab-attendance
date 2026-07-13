// Client-facing report response contracts. Pure data shapes shared by the report
// service (producer) and the report components (consumer) — kept in types/ so the
// frontend never imports from @/server. Repo-internal row types stay in the repos.

import type { AttendanceStatus } from "@/lib/attendance-status";

export type WeekBucket = {
  weekStart: string; // ISO instant of the PKT week's Sunday 00:00
  present: number; total: number; rate: number; sessions: number;
};

// The attendance report body — shared by the city report and any node-scoped report.
export type ReportBody = {
  overall: { present: number; total: number; rate: number; sessions: number };
  byStatus: Record<AttendanceStatus, number>;
  byNode: {
    nodeId: string; nodeName: string; level: string;
    sessions: number; present: number; total: number; rate: number;
  }[];
  trend: { when: string; rate: number }[];
  weekly: WeekBucket[];
  weekSummary: { thisWeek: WeekBucket; lastWeek: WeekBucket; deltaPts: number };
};

export type CityReport = { city: { id: string; name: string } } & ReportBody;

// A person tracked under the node, with their rate over the report's period —
// the node report's "people here" triage list.
export type NodePerson = {
  id: string; name: string; role: string | null;
  present: number; total: number; rate: number;
};

// One breadcrumb crumb: an ancestor of the node (isCity marks the city crumb, which
// links to the city report rather than a node report).
export type Crumb = { id: string; name: string; isCity: boolean };

export type NodeReport = {
  node: { id: string; name: string; level: string };
  people: NodePerson[];
  peopleTruncated: boolean;
  trail: Crumb[];
} & ReportBody;

export type PersonReport = {
  person: { id: string; name: string };
  overall: { present: number; total: number; rate: number };
  byStatus: Record<AttendanceStatus, number>;
  trend: number[]; // per-session "lit" value (present/late 100, excused 40, absent 0), oldest→newest
  sessions: { eventId: string; title: string; when: string; nodeId: string; nodeName: string; status: AttendanceStatus }[];
};
