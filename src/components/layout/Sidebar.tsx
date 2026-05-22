"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavItems } from "./nav-items";

interface SidebarProps {
  userRoles: string;
}

export default function Sidebar({ userRoles }: SidebarProps) {
  const pathname = usePathname();
  const visibleItems = getVisibleNavItems(userRoles);

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-56 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200">
      <div className="flex items-center h-14 px-5 border-b border-gray-200">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-md bg-gray-900 flex items-center justify-center text-white font-semibold text-xs">
            A
          </div>
          <span className="font-semibold text-gray-900 text-sm tracking-tight">Attendance</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-3 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors duration-100 border-l-2 ${
                isActive
                  ? "bg-[var(--accent-light)] text-[var(--accent-text)] border-[var(--accent)]"
                  : "text-gray-500 hover:bg-gray-50 hover:text-gray-800 border-transparent"
              }`}
            >
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
              </svg>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
