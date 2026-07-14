"use client";

// Desktop command-center sidebar. Persistent left rail with icon+label nav, an
// active indicator, and a footer for account actions. Hidden below lg (mobile
// keeps the top bar + bottom tab bar).

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import type { NavItem } from "./AppNav";

const ICONS: Record<string, React.ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
  attendance: <path d="M9 11l3 3 8-8M4 7v13h16M4 7l3-3h6" />,
  hierarchy: <path d="M12 3v4M6 21v-4m12 4v-4M4 13h16v4H4zM9 7h6v4H9z" />,
  roles: <path d="M12 3l7 4v5c0 4-3 7-7 9-4-2-7-5-7-9V7z" />,
  cities: <path d="M3 21h18M6 21V8l6-4 6 4v13M10 21v-4h4v4" />,
  reports: <path d="M4 20V11M10 20V4M16 20v-6M20 20H3" />,
  intake: <path d="M4 20a6 6 0 0 1 11-3.3M13 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0M18 13v6M15 16h6" />,
  profile: <path d="M4 20a8 8 0 0 1 16 0M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z" />,
};

function Icon({ name }: { name?: string }) {
  return (
    <svg
      className="h-[18px] w-[18px] shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {(name && ICONS[name]) ?? ICONS.home}
    </svg>
  );
}

export type NavGroup = { label?: string; items: NavItem[] };

export function Sidebar({
  groups,
  appName,
  topSlot,
  footer,
}: {
  groups: NavGroup[];
  appName: string;
  topSlot?: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/");
  return (
    <aside className="fixed inset-y-0 start-0 z-40 hidden w-60 flex-col border-e border-slate-200/80 bg-white/70 backdrop-blur-xl lg:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.04)]">
          <Image src="/logo.png" alt="" width={20} height={20} priority unoptimized />
        </span>
        <span className="text-[15px] font-semibold tracking-tight text-slate-900">{appName}</span>
      </div>

      {topSlot && <div className="px-3 pb-2">{topSlot}</div>}

      <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
        {groups.map((group, gi) => (
          <div key={group.label ?? gi} className="space-y-0.5">
            {group.label && (
              <div className="px-3 pb-1 text-[10.5px] font-semibold uppercase tracking-[0.09em] text-slate-400">
                {group.label}
              </div>
            )}
            {group.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group relative flex items-center gap-3 rounded-xl px-3 py-2 text-[13.5px] font-medium transition ${
                    active
                      ? "bg-[#2f55ea]/[0.07] text-[#2f55ea]"
                      : "text-slate-500 hover:bg-slate-100/70 hover:text-slate-900"
                  }`}
                >
                  {active && (
                    <span className="absolute inset-y-1.5 start-0 w-1 rounded-full bg-[#2f55ea]" aria-hidden />
                  )}
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {footer && <div className="border-t border-slate-200/80 p-3">{footer}</div>}
    </aside>
  );
}
