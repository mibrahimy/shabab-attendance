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

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f4f3ff] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-4 flex justify-end">
          <LocaleToggle />
        </div>
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white shadow-lg shadow-[#2f55ea]/15">
            <Image src="/logo.png" alt="Shabab" width={40} height={40} priority unoptimized />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900">{t("login.title")}</h1>
          <p className="mt-1.5 text-sm text-gray-500">{t("login.subtitle")}</p>
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
            <label htmlFor="identifier" className="mb-1.5 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-gray-700">
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
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20"
            />
          </div>

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-xl bg-[#2f55ea] py-2.5 font-medium text-white transition hover:bg-[#2546c9] disabled:opacity-60"
          >
            {pending ? `${t("login.submit")}…` : t("login.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
