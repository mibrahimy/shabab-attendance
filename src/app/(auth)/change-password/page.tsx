"use client";

// Forced / voluntary password change. The new-password field shows live strength
// feedback (PasswordStrength) and submit stays disabled until the policy passes
// and the confirmation matches — the same checkPassword the server enforces.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { checkPassword } from "@/lib/password-policy";
import { PasswordStrength } from "@/components/auth/PasswordStrength";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const policyOk = checkPassword(newPassword).valid;
  const matches = newPassword.length > 0 && newPassword === confirm;
  const canSubmit = currentPassword.length > 0 && policyOk && matches && !pending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? "Could not change password");
        return;
      }
      router.replace("/");
    } catch {
      setError("Network error — please try again");
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f3ff] px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">Set a new password</h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Choose a strong password to secure your account.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div
              role="alert"
              className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="current" className="mb-1.5 block text-sm font-medium text-gray-700">
              Current password
            </label>
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="new" className="mb-1.5 block text-sm font-medium text-gray-700">
              New password
            </label>
            <input
              id="new"
              type="password"
              autoComplete="new-password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={inputClass}
            />
            <PasswordStrength password={newPassword} />
          </div>

          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-medium text-gray-700">
              Confirm new password
            </label>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={inputClass}
            />
            {confirm.length > 0 && !matches && (
              <p className="mt-1.5 text-xs text-rose-600">Passwords don’t match</p>
            )}
          </div>

          <button
            type="submit"
            disabled={!canSubmit}
            className="w-full rounded-xl bg-[#2f55ea] py-2.5 font-medium text-white transition hover:bg-[#2546c9] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Saving…" : "Update password"}
          </button>
        </form>
      </div>
    </div>
  );
}
