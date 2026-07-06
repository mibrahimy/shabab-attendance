"use client";

// Mobile bottom tab bar (hidden on desktop, where the top nav shows). Renders the
// same grant-gated nav items the layout computes, so tabs adapt per persona, plus
// a Profile tab for account actions. Active tab via the current path.

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { NavItem } from "./AppNav";

function Icon({ name }: { name: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, viewBox: "0 0 24 24" };
  const p = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const paths: Record<string, React.ReactNode> = {
    home: <path {...p} d="M3 10.5 12 3l9 7.5M5 9.5V21h14V9.5" />,
    cities: <path {...p} d="M4 21V5l8-2 8 2v16M9 21v-4h6v4M8 8h.01M8 12h.01M16 8h.01M16 12h.01" />,
    attendance: <path {...p} d="M9 11l3 3L22 4M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />,
    hierarchy: <path {...p} d="M12 3v4M6 21v-4M18 21v-4M4 17h4v4H4zM10 3h4v4h-4zM16 17h4v4h-4zM8 17V11h8v6" />,
    roles: <path {...p} d="M16 11a4 4 0 1 0-8 0M12 3v0M4 21a8 8 0 0 1 16 0" />,
    profile: <path {...p} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0" />,
  };
  return (
    <svg className="h-5 w-5" {...common}>
      {paths[name] ?? paths.home}
    </svg>
  );
}

export function BottomTabBar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  // Hide on focused attendance sub-screens (a specific event's Mark/Report) so the
  // sticky Save bar isn't obscured — these are focused flows, not top-level nav.
  if (/^\/mark\/[^/]+/.test(pathname)) return null;
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <ul className="mx-auto flex max-w-md items-stretch justify-around">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ${
                  active ? "text-[#2f55ea]" : "text-gray-400"
                }`}
              >
                <Icon name={item.icon ?? "home"} />
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
