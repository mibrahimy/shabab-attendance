// Single source of event-status presentation (scheduled / completed / cancelled),
// so every surface that shows an event's status renders it identically. The ring
// variant is canonical (mirrors status-styles.ts for attendance P/L/A/E).

export type EventStatus = "scheduled" | "completed" | "cancelled";

// Soft tinted background + colored text + inset ring — used as a small pill.
export const EVENT_STATUS_PILL: Record<EventStatus, string> = {
  scheduled: "bg-[#2f55ea]/[0.07] text-[#2f55ea] ring-[#2f55ea]/20",
  completed: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  cancelled: "bg-slate-100 text-slate-500 ring-slate-500/20",
};
