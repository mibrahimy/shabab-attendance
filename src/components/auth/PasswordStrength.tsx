"use client";

// Live password-strength feedback. Drives its checklist + meter straight from the
// shared password-policy module, so what the user sees here is exactly what the
// server enforces. Presentational — pass the current password in.

import { checkPassword, PASSWORD_CRITERIA } from "@/lib/password-policy";

const STRENGTH_LABELS = ["Too weak", "Weak", "Fair", "Good", "Strong"];

export function PasswordStrength({ password }: { password: string }) {
  const { checks } = checkPassword(password);
  const passed = Object.values(checks).filter(Boolean).length;
  const total = PASSWORD_CRITERIA.length;

  // Empty field: show the requirements but no scary "too weak" yet.
  const ratio = password.length === 0 ? 0 : passed / total;
  const barColor =
    ratio === 1 ? "bg-emerald-500" : ratio >= 0.6 ? "bg-amber-500" : "bg-rose-500";

  return (
    <div className="mt-3" aria-live="polite">
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-gray-200">
          <div
            className={`h-full rounded-full transition-all duration-300 ${barColor}`}
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        {password.length > 0 && (
          <span className="w-16 shrink-0 text-end text-xs font-medium text-gray-500">
            {STRENGTH_LABELS[passed]}
          </span>
        )}
      </div>

      <ul className="mt-2.5 space-y-1">
        {PASSWORD_CRITERIA.map(({ key, label }) => {
          const ok = checks[key];
          return (
            <li
              key={key}
              className={`flex items-center gap-2 text-xs ${
                ok ? "text-emerald-600" : "text-gray-500"
              }`}
            >
              <span
                aria-hidden
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
                  ok ? "bg-emerald-100 text-emerald-600" : "bg-gray-100 text-gray-400"
                }`}
              >
                {ok ? "✓" : "○"}
              </span>
              <span>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
