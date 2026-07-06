// Attendance status vocabulary + the offline last-write-wins rule, shared by the
// client outbox and the server upsert so both resolve conflicts identically.

export const ATTENDANCE_STATUSES = ["present", "late", "absent", "excused"] as const;
export type AttendanceStatus = (typeof ATTENDANCE_STATUSES)[number];

export const DEFAULT_STATUS: AttendanceStatus = "absent";

export function isAttendanceStatus(v: unknown): v is AttendanceStatus {
  return typeof v === "string" && (ATTENDANCE_STATUSES as readonly string[]).includes(v);
}

// Last-write-wins by client timestamp: apply the incoming mark only when it is
// strictly newer than what's stored. A missing stored timestamp (never marked, or
// a legacy row) always yields to an incoming client mark. Equal timestamps do NOT
// re-apply (idempotent replay).
export function shouldApplyMark(
  existing: Date | string | null | undefined,
  incoming: Date | string,
): boolean {
  const inMs = new Date(incoming).getTime();
  if (existing == null) return true;
  return inMs > new Date(existing).getTime();
}
