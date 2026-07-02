// Per-request i18next instance for Server Components / layouts. react-i18next is
// client-first, so on the server we create a fresh instance (no shared mutable
// global) and return its translator — the App-Router pattern.

import { createInstance, type i18n as I18n } from "i18next";
import { initReactI18next } from "react-i18next";
import { DEFAULT_NAMESPACE, type Locale, type Namespace } from "./config";
import { resources } from "./resources";

export async function getServerI18n(
  locale: Locale,
  ns: Namespace | Namespace[] = DEFAULT_NAMESPACE,
): Promise<{ t: I18n["t"]; i18n: I18n }> {
  const instance = createInstance();
  await instance.use(initReactI18next).init({
    lng: locale,
    fallbackLng: "en",
    supportedLngs: ["en", "ur"],
    ns,
    defaultNS: DEFAULT_NAMESPACE,
    resources,
    interpolation: { escapeValue: false },
  });
  return { t: instance.t, i18n: instance };
}
