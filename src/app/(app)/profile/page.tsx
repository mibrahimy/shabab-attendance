// Profile — account actions reachable from the mobile Profile tab: language and
// sign out. (On desktop these live in the top bar; this page backs the tab.)

import { getServerI18n } from "@/i18n/server";
import { getLocale } from "@/i18n/get-locale";
import { LocaleToggle } from "@/components/app/LocaleToggle";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function ProfilePage() {
  const { t } = await getServerI18n(await getLocale(), "common");
  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="text-xl font-semibold tracking-tight text-gray-900">{t("nav.profile")}</h1>
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-4">
        <span className="text-sm font-medium text-gray-700">{t("locale.label")}</span>
        <LocaleToggle />
      </div>
      <SignOutButton />
    </div>
  );
}
