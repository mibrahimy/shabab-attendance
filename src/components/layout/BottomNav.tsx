"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { getVisibleNavItems } from "./nav-items";

interface BottomNavProps {
  userRoles: string;
}

export default function BottomNav({ userRoles }: BottomNavProps) {
  const pathname = usePathname();
  const visibleItems = getVisibleNavItems(userRoles);

  return (
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50">
      <div className="flex items-center justify-around h-14">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] px-2 py-1 rounded-lg transition-colors ${
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.iconPath} />
              </svg>
              <span className="text-[10px] mt-0.5 font-medium">
                {item.label === "Dashboard" ? "Home" : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
