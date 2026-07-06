// Badge color per org level, shared by the hierarchy builder and the tree overview.
// Pure (no React) — just a lookup keyed by the canonical level key.

import type { BadgeColor } from "@/types";

export const LEVEL_COLORS: Record<string, BadgeColor> = {
  city: "slate",
  zone: "blue",
  sector: "pink",
  park: "green",
  class: "amber",
};

export function levelColor(key: string): BadgeColor {
  return LEVEL_COLORS[key] ?? "gray";
}
