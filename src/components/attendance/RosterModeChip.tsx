"use client";

// A small "Team" chip marking an event whose roster is the node's derived team
// (its lead + its sub-locations' leads) rather than directly-assigned members.
// Members events show nothing — the default needs no label, keeping cards clean.

import { useTranslation } from "react-i18next";

export function RosterModeChip({ mode }: { mode: "members" | "team" }) {
  const { t } = useTranslation("attendance");
  if (mode !== "team") return null;
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#eef1fe] px-2 py-0.5 text-[11px] font-semibold text-[#2f55ea]">
      <span aria-hidden>◈</span>
      {t("rosterMode.team", "Team")}
    </span>
  );
}
