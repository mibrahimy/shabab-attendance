// v2 authed shell. Middleware guarantees a valid, password-changed session before
// this renders; getAuthzContext additionally proves liveness and gives us the
// grants to gate nav. A thin top bar + ToastProvider; no v1 coupling.

import Image from "next/image";
import { cookies } from "next/headers";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";
import { ToastProvider } from "@/components/ui/Toast";
import { type NavItem } from "@/components/app/AppNav";
import { Sidebar, type NavGroup } from "@/components/app/Sidebar";
import { CitySwitcher } from "@/components/app/CitySwitcher";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LocaleToggle } from "@/components/app/LocaleToggle";
import { getLocale } from "@/i18n/get-locale";
import { getServerI18n } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthzContext();
  const { t } = await getServerI18n(await getLocale(), "common");

  // City context (switcher) — scopes the operational + admin links.
  const preferredCity = (await cookies()).get("sb_city")?.value ?? null;
  const [cityId, cities] = await Promise.all([
    hierarchyService.getDefaultCityId(ctx, preferredCity),
    hierarchyService.listSwitchableCities(ctx),
  ]);

  const canAttend =
    ctx.isSuperadmin ||
    ctx.grants.some((g) => g.permission === "mark_attendance" || g.permission === "view_attendance");
  // Intake (add shabab to a class) is gated on add_member — the same authority the
  // /intake surface and the members POST enforce.
  const canAddMember =
    ctx.isSuperadmin || ctx.grants.some((g) => g.permission === "add_member");

  // Operations: the day-to-day. Administration: managing the org.
  const operations: NavItem[] = [{ href: "/", label: t("nav.home"), icon: "home" }];
  if (canAttend) operations.push({ href: "/mark", label: t("nav.attendance"), icon: "attendance" });
  if (canAddMember) operations.push({ href: "/intake", label: t("nav.intake"), icon: "intake" });

  const admin: NavItem[] = [];
  if (cityId) {
    admin.push({ href: `/hierarchy/${cityId}`, label: t("nav.hierarchy"), icon: "hierarchy" });
    admin.push({ href: `/roles/${cityId}`, label: t("nav.roles"), icon: "roles" });
    admin.push({ href: `/reports/${cityId}`, label: t("nav.reports"), icon: "reports" });
  }
  if (ctx.isSuperadmin) admin.push({ href: "/cities", label: t("nav.cities"), icon: "cities" });

  const groups: NavGroup[] = [
    { label: t("nav.group.operations"), items: operations },
    ...(admin.length ? [{ label: t("nav.group.administration"), items: admin }] : []),
  ];

  // Mobile bottom bar stays lean: operations + hierarchy (if any) + profile.
  const tabs: NavItem[] = [
    ...operations,
    ...(cityId ? [{ href: `/hierarchy/${cityId}`, label: t("nav.hierarchy"), icon: "hierarchy" }] : []),
    { href: "/profile", label: t("nav.profile"), icon: "profile" },
  ];

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {/* Desktop: persistent command-center sidebar. */}
      <Sidebar
        groups={groups}
        appName={t("app.name")}
        topSlot={cities.length > 0 ? <CitySwitcher cities={cities} currentId={cityId} /> : undefined}
        footer={
          <div className="flex items-center justify-between gap-2">
            <LocaleToggle />
            <SignOutButton />
          </div>
        }
      />

      {/* Mobile: slim top bar (the bottom tab bar handles nav). */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <span className="flex items-center gap-2 font-semibold text-slate-900">
            <Image src="/logo.png" alt="" width={26} height={26} priority unoptimized />
            {t("app.name")}
          </span>
          <div className="flex items-center gap-2">
            <LocaleToggle />
            <SignOutButton />
          </div>
        </div>
      </header>

      <div className="lg:ps-60">
        <ToastProvider>
          <main className="mx-auto max-w-6xl px-4 py-6 pb-24 lg:px-8 lg:py-8 lg:pb-10">{children}</main>
        </ToastProvider>
      </div>
      <BottomTabBar items={tabs} />
    </div>
  );
}
