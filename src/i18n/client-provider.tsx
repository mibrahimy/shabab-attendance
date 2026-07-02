"use client";

// Client i18next provider. Initialized once (module-level instance) from the
// locale the server resolved, using the same bundled resources — client
// components then call useTranslation(ns).

import { createInstance } from "i18next";
import { I18nextProvider, initReactI18next } from "react-i18next";
import { DEFAULT_NAMESPACE, NAMESPACES, type Locale } from "./config";
import { resources } from "./resources";

const instance = createInstance();
instance.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  supportedLngs: ["en", "ur"],
  ns: NAMESPACES,
  defaultNS: DEFAULT_NAMESPACE,
  resources,
  interpolation: { escapeValue: false },
});

export function I18nProvider({
  locale,
  children,
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  // Keep the client instance in sync with the server-resolved locale (changes on
  // toggle, since the tree re-renders after router.refresh + cookie set).
  if (instance.language !== locale) {
    void instance.changeLanguage(locale);
  }
  return <I18nextProvider i18n={instance}>{children}</I18nextProvider>;
}
