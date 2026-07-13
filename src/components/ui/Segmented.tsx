"use client";

// The one segmented control — a pill track with an active royal-blue segment.
// Replaces four divergent inline copies (hub scopes, hierarchy view toggle, report
// periods, create-event options). Options render as buttons (onChange) or, when an
// option carries `href`, as links (used for URL-driven state like report periods).

import Link from "next/link";
import type { ReactNode } from "react";

export type SegmentedOption<T extends string> = { value: T; label: ReactNode; href?: string };

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  fullWidth = false,
  ariaLabel,
}: {
  value: T;
  options: SegmentedOption<T>[];
  onChange?: (value: T) => void;
  fullWidth?: boolean;
  ariaLabel?: string;
}) {
  const track = `inline-flex rounded-xl border border-slate-200/70 bg-white p-0.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]${
    fullWidth ? " w-full" : ""
  }`;
  const seg = (active: boolean) =>
    `rounded-lg px-3.5 py-1.5 font-medium transition ${fullWidth ? "flex-1 text-center" : ""} ${
      active ? "bg-[#2f55ea] text-white" : "text-slate-500 hover:text-slate-900"
    }`;

  return (
    <div className={track} role="group" aria-label={ariaLabel}>
      {options.map((o) => {
        const active = o.value === value;
        if (o.href) {
          return (
            <Link key={o.value} href={o.href} aria-current={active ? "true" : undefined} className={seg(active)}>
              {o.label}
            </Link>
          );
        }
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => onChange?.(o.value)}
            aria-pressed={active}
            className={seg(active)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
