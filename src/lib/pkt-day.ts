// "Today" is computed in a single fixed timezone — Asia/Karachi (PKT), UTC+5 with
// no DST — for all cities (the entire user base is in Pakistan). Revisit only if a
// city outside PKT is ever added.

const PKT_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5, fixed (no DST)

// The UTC instants [start, end) bounding *today in Asia/Karachi* for a given moment.
// Shift into PKT, floor to the PKT calendar day, then shift back to UTC.
export function pktDayRange(now: Date = new Date()): { start: Date; end: Date } {
  const shifted = new Date(now.getTime() + PKT_OFFSET_MS);
  // Midnight of that PKT day, expressed in the shifted (PKT-as-UTC) clock.
  const pktMidnight = Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
  );
  const startMs = pktMidnight - PKT_OFFSET_MS; // back to real UTC
  return { start: new Date(startMs), end: new Date(startMs + 24 * 60 * 60 * 1000) };
}
