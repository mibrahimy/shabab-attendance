// Calendar-week boundaries in a single fixed timezone — Asia/Karachi (PKT, UTC+5,
// no DST) — matching the "today" logic in pkt-day.ts. A week runs Sunday 00:00 →
// Saturday 23:59 PKT. Revisit only if a city outside PKT is ever added.

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, fixed (no DST)
const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

// UTC instant of Sunday 00:00 PKT for the week that contains `date`. Shift into
// PKT, floor to that PKT day, step back to the PKT week's Sunday, shift to UTC.
export function pktWeekStart(date: Date): Date {
  const shifted = new Date(date.getTime() + PKT_OFFSET_MS);
  const pktDow = shifted.getUTCDay(); // 0 = Sunday, in the PKT-as-UTC clock
  const pktMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const sundayPktMidnight = pktMidnight - pktDow * DAY_MS;
  return new Date(sundayPktMidnight - PKT_OFFSET_MS); // back to real UTC
}

// The UTC [start, end) bounding the current PKT week.
export function pktWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = pktWeekStart(now);
  return { start, end: new Date(start.getTime() + WEEK_MS) };
}

// The UTC [start, end) bounding the PKT week before the current one.
export function pktPrevWeekRange(now: Date = new Date()): { start: Date; end: Date } {
  const { start: thisStart } = pktWeekRange(now);
  const start = new Date(thisStart.getTime() - WEEK_MS);
  return { start, end: thisStart };
}
