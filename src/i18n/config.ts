// i18n configuration — pure leaf (no React, no server APIs), importable anywhere.

export const LOCALES = ["en", "ur"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

// The cookie that carries the chosen locale across requests.
export const LOCALE_COOKIE = "NEXT_LOCALE";

// The namespaces (one JSON file per locale per namespace). Add a surface's
// namespace here as its strings are extracted.
export const NAMESPACES = ["common", "auth", "attendance", "hierarchy", "home"] as const;
export type Namespace = (typeof NAMESPACES)[number];
export const DEFAULT_NAMESPACE: Namespace = "common";

export function isLocale(value: string | undefined | null): value is Locale {
  return !!value && (LOCALES as readonly string[]).includes(value);
}

// Text direction for a locale — Urdu is right-to-left.
export function dir(locale: Locale): "ltr" | "rtl" {
  return locale === "ur" ? "rtl" : "ltr";
}
