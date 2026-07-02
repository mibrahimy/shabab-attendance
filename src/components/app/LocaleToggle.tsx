"use client";

// Language switcher. Writes the NEXT_LOCALE cookie and refreshes so the server
// re-resolves the locale (root layout re-renders <html lang/dir> + font, and RSC
// pick up new strings). No URL change — locale lives in the cookie.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import { LOCALES, LOCALE_COOKIE, type Locale } from "@/i18n/config";

// Persist the locale for a year, app-wide. Kept out of the component so the
// document mutation isn't flagged as render-time state mutation.
function persistLocale(locale: Locale): void {
  document.cookie = `${LOCALE_COOKIE}=${locale}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

export function LocaleToggle() {
  const router = useRouter();
  const { i18n, t } = useTranslation("common");
  const [pending, startTransition] = useTransition();
  const current = (i18n.language as Locale) ?? "en";

  function choose(locale: Locale) {
    if (locale === current) return;
    persistLocale(locale);
    startTransition(() => router.refresh());
  }

  return (
    <div className="inline-flex items-center gap-1" aria-label={t("locale.label")}>
      {LOCALES.map((loc) => (
        <button
          key={loc}
          onClick={() => choose(loc)}
          disabled={pending}
          aria-pressed={loc === current}
          className={`rounded-md px-2 py-1 text-xs font-medium transition ${
            loc === current
              ? "bg-[#2f55ea] text-white"
              : "text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          }`}
        >
          {t(`locale.${loc}`)}
        </button>
      ))}
    </div>
  );
}
