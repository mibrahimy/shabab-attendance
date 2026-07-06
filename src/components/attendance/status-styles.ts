// Single source of attendance-status presentation (letter + colors), so every
// attendance surface renders a status identically. Colors from the design mockup.

import type { AttendanceStatus } from "@/lib/attendance-status";

export const STATUS_LETTER: Record<AttendanceStatus, string> = {
  present: "P",
  late: "L",
  absent: "A",
  excused: "E",
};

// Solid (selected segmented button / strong chip): colored background, white text.
export const STATUS_SOLID: Record<AttendanceStatus, string> = {
  present: "bg-[#15a34a] text-white",
  late: "bg-[#ef8a23] text-white",
  absent: "bg-[#dc2626] text-white",
  excused: "bg-[#5b6b8c] text-white",
};

// Soft (summary chips / tallies): tinted background, colored text.
export const STATUS_SOFT: Record<AttendanceStatus, string> = {
  present: "bg-[#e7f6ed] text-[#15a34a]",
  late: "bg-[#fdf1e3] text-[#ef8a23]",
  absent: "bg-[#fdecec] text-[#dc2626]",
  excused: "bg-[#eef1f6] text-[#5b6b8c]",
};

// Text-only status color (for color-coded counts in the live summary).
export const STATUS_TEXT: Record<AttendanceStatus, string> = {
  present: "text-[#15a34a]",
  late: "text-[#ef8a23]",
  absent: "text-[#dc2626]",
  excused: "text-[#5b6b8c]",
};

// The soft box-shadow "glow" under a selected status button (mockup detail).
export const STATUS_GLOW: Record<AttendanceStatus, string> = {
  present: "shadow-[0_2px_6px_-2px_#15a34a]",
  late: "shadow-[0_2px_6px_-2px_#ef8a23]",
  absent: "shadow-[0_2px_6px_-2px_#dc2626]",
  excused: "shadow-[0_2px_6px_-2px_#5b6b8c]",
};
