// v2 authed shell. Middleware guarantees a valid, password-changed session before
// this renders; getAuthzContext additionally proves liveness and gives us the
// grants to gate nav. A thin top bar + ToastProvider; no v1 coupling.

import Image from "next/image";
import { getAuthzContext } from "@/server/auth/authz-context";
import { ToastProvider } from "@/components/ui/Toast";
import { type NavItem } from "@/components/app/AppNav";
import { Sidebar } from "@/components/app/Sidebar";
import { BottomTabBar } from "@/components/app/BottomTabBar";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { LocaleToggle } from "@/components/app/LocaleToggle";
import { getLocale } from "@/i18n/get-locale";
import { getServerI18n } from "@/i18n/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthzContext();
  const { t } = await getServerI18n(await getLocale(), "common");

  const nav: NavItem[] = [{ href: "/", label: t("nav.home"), icon: "home" }];
  if (ctx.isSuperadmin) nav.push({ href: "/cities", label: t("nav.cities"), icon: "cities" });
  // Attendance is for anyone who can mark or view it (or a superadmin).
  if (
    ctx.isSuperadmin ||
    ctx.grants.some((g) => g.permission === "mark_attendance" || g.permission === "view_attendance")
  ) {
    nav.push({ href: "/mark", label: t("nav.attendance"), icon: "attendance" });
  }
  // The city-wide Hierarchy and Roles views are for a city admin. Gate on a
  // manage_city grant (only city admins hold it) rather than any cityId-bearing
  // grant — a park admin also carries a cityId but is anchored deeper, so the
  // city-level pages would 403 and the link would dead-end.
  const managedCityId = ctx.isSuperadmin
    ? null
    : ctx.grants.find((g) => g.permission === "manage_city" && g.cityId)?.cityId;
  if (managedCityId) {
    nav.push({ href: `/hierarchy/${managedCityId}`, label: t("nav.hierarchy"), icon: "hierarchy" });
    nav.push({ href: `/roles/${managedCityId}`, label: t("nav.roles"), icon: "roles" });
  }

  // Profile is a mobile-only tab (its actions live in the top bar on desktop).
  const tabs: NavItem[] = [...nav, { href: "/profile", label: t("nav.profile"), icon: "profile" }];

  return (
    <div className="min-h-screen bg-[#f6f7f9]">
      {/* Desktop: persistent command-center sidebar. */}
      <Sidebar
        items={nav}
        appName={t("app.name")}
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
