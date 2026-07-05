// Per-request i18next instance for Server Components / layouts. We use PLAIN
// i18next here (no react-i18next binding): initReactI18next calls
// React.createContext at module load, which throws inside a Server Component.
// The bare instance's `t` is all the server needs; the client provider handles
// the React hook side.

import { createInstance, type i18n as I18n } from "i18next";
import { DEFAULT_NAMESPACE, type Locale, type Namespace } from "./config";
import { resources } from "./resources";

export async function getServerI18n(
  locale: Locale,
  ns: Namespace | Namespace[] = DEFAULT_NAMESPACE,
): Promise<{ t: I18n["t"]; i18n: I18n }> {
  const instance = createInstance();
  await instance.init({
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
