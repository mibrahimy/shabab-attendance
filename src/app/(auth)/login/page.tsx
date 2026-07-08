"use client";

// v2 login — CNIC (or legacy email) + password. Posts to /api/auth/login and
// routes to the forced password change when the account still requires it.

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { formatCnic } from "@/lib/cnic";
import { LocaleToggle } from "@/components/app/LocaleToggle";

export default function LoginPage() {
  const router = useRouter();
  const { t } = useTranslation(["auth", "common"]);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json?.error?.message ?? t("login.error"));
        return;
      }
      router.replace(json.data.mustChangePassword ? "/change-password" : "/");
    } catch {
      setError(t("login.error"));
    } finally {
      setPending(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15";

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#f6f7f9] px-4">
      {/* Soft accent glow */}
      <div
        className="pointer-events-none absolute -top-32 start-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full opacity-60 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(47,85,234,0.18), transparent)" }}
        aria-hidden
      />
      <div className="relative w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LocaleToggle />
        </div>

        <div className="rounded-3xl border border-slate-200/70 bg-white p-8 shadow-[0_1px_3px_rgba(16,24,40,0.06),0_12px_40px_rgba(16,24,40,0.08)]">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-[0_1px_2px_rgba(16,24,40,0.08),0_0_0_1px_rgba(16,24,40,0.05)]">
              <Image src="/logo.png" alt="Shabab" width={38} height={38} priority unoptimized />
            </div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">{t("login.title")}</h1>
            <p className="mt-1.5 text-sm text-slate-500">{t("login.subtitle")}</p>
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
              <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("login.identifier")}
              </label>
              <input
                id="identifier"
                name="identifier"
                type="text"
                autoComplete="username"
                required
                value={identifier}
                onChange={(e) => setIdentifier(formatCnic(e.target.value))}
                inputMode="numeric"
                placeholder="00000-0000000-0"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                {t("login.password")}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={inputClass}
              />
            </div>

            <button
              type="submit"
              disabled={pending}
              className="w-full rounded-xl bg-[#2f55ea] py-2.5 font-semibold text-white shadow-[0_1px_2px_rgba(16,24,40,0.1),0_4px_12px_rgba(47,85,234,0.25)] transition hover:bg-[#2848c8] disabled:opacity-60"
            >
              {pending ? `${t("login.submit")}…` : t("login.submit")}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
