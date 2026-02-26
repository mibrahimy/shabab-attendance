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
    <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-gray-200/80">
      <div className="flex items-center h-16 px-6 border-b border-gray-200/80">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center text-white font-bold text-sm shadow-sm">
            A
          </div>
          <span className="font-semibold text-gray-900 tracking-tight">Attendance</span>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 ${
                isActive
                  ? "bg-blue-50 text-blue-700 shadow-sm shadow-blue-100"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2} viewBox="0 0 24 24">
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
