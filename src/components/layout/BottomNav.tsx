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
    <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-gray-200/80 z-50 safe-bottom">
      <div className="flex items-center justify-around h-16">
        {visibleItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center min-w-[64px] min-h-[44px] px-2 py-1 rounded-xl transition-all duration-150 active:scale-90 ${
                isActive
                  ? "text-blue-600"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              <div className={`relative p-1 rounded-xl transition-colors duration-150 ${isActive ? "bg-blue-50" : ""}`}>
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={isActive ? 2.5 : 2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                </svg>
              </div>
              <span className={`text-[11px] mt-0.5 transition-colors duration-150 ${isActive ? "font-semibold" : "font-medium"}`}>
                {item.label === "Dashboard" ? "Home" : item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
