"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export function SignOutButton() {
  const router = useRouter();
  const { t } = useTranslation("common");
  const [pending, setPending] = useState(false);

  async function signOut() {
    setPending(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
  }

  return (
    <button
      onClick={signOut}
      disabled={pending}
      className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
    >
      {pending ? `${t("actions.signOut")}…` : t("actions.signOut")}
    </button>
  );
}
