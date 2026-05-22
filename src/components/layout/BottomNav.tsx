"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { getVisibleNavItems } from "./nav-items";

interface BottomNavProps {
  userRoles: string;
}

export default function BottomNav({ userRoles }: BottomNavProps) {
  const pathname = usePathname();
  const visibleItems = getVisibleNavItems(userRoles);
  const [moreOpen, setMoreOpen] = useState(false);

  const primaryItems = visibleItems.filter((item) => item.primary);
  const moreItems = visibleItems.filter((item) => !item.primary);
  const isMoreActive = moreItems.some((item) => pathname === item.href);

  return (
    <>
      <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white border-t border-gray-200 z-50 safe-bottom">
        <div className="flex items-center justify-around h-14">
          {primaryItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="relative flex flex-col items-center justify-center min-w-[60px] min-h-[44px] px-2 py-1 transition-colors duration-100 active:scale-95"
              >
                {isActive && (
                  <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--accent)]" />
                )}
                <svg
                  className={`w-5 h-5 transition-colors duration-100 ${isActive ? "text-[var(--accent)]" : "text-gray-400"}`}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={isActive ? 2.5 : 2}
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                </svg>
                <span className={`text-[10px] mt-0.5 transition-colors duration-100 ${isActive ? "font-semibold text-[var(--accent)]" : "font-medium text-gray-400"}`}>
                  {item.label === "Dashboard" ? "Home" : item.label}
                </span>
              </Link>
            );
          })}

          {moreItems.length > 0 && (
            <button
              onClick={() => setMoreOpen(true)}
              className="relative flex flex-col items-center justify-center min-w-[60px] min-h-[44px] px-2 py-1 transition-colors duration-100 active:scale-95"
            >
              {isMoreActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-[var(--accent)]" />
              )}
              <svg
                className={`w-5 h-5 ${isMoreActive ? "text-[var(--accent)]" : "text-gray-400"}`}
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className={`text-[10px] mt-0.5 font-medium ${isMoreActive ? "font-semibold text-[var(--accent)]" : "text-gray-400"}`}>
                More
              </span>
            </button>
          )}
        </div>
      </nav>

      {moreItems.length > 0 && moreOpen && (
        <div
          className="lg:hidden fixed inset-0 z-[60]"
          onClick={() => setMoreOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[modalBackdropIn_0.2s_ease-out]" />
          <div
            className="absolute bottom-0 inset-x-0 bg-white rounded-t-2xl animate-[modalSheetIn_0.25s_ease-out]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-gray-300" />
            </div>
            <div className="px-4 pb-8 pt-2 space-y-1">
              {moreItems.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMoreOpen(false)}
                    className={`flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-[var(--accent-light)] text-[var(--accent-text)]"
                        : "text-gray-700 active:bg-gray-100"
                    }`}
                  >
                    <svg
                      className={`w-5 h-5 shrink-0 ${isActive ? "text-[var(--accent)]" : "text-gray-400"}`}
                      fill="none"
                      stroke="currentColor"
                      strokeWidth={isActive ? 2.5 : 2}
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d={item.iconPath} />
                    </svg>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
