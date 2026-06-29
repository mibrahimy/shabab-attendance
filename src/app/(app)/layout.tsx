// v2 authed shell. Middleware guarantees a valid, password-changed session before
// this renders; getAuthzContext additionally proves liveness and gives us the
// grants to gate nav. A thin top bar + ToastProvider; no v1 coupling.

import { getAuthzContext } from "@/server/auth/authz-context";
import { ToastProvider } from "@/components/ui/Toast";
import { AppNav, type NavItem } from "@/components/app/AppNav";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ctx = await getAuthzContext();

  const nav: NavItem[] = [{ href: "/", label: "Home" }];
  if (ctx.isSuperadmin) nav.push({ href: "/cities", label: "Cities" });
  // A city admin manages one city — link straight to its hierarchy. Derive it from
  // the grant that carries a (non-global) cityId.
  const managedCityId = ctx.isSuperadmin ? null : ctx.grants.find((g) => g.cityId)?.cityId;
  if (managedCityId) nav.push({ href: `/hierarchy/${managedCityId}`, label: "Hierarchy" });

  return (
    <div className="min-h-screen bg-[#f4f3ff]">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 font-semibold text-gray-900">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#2f55ea] text-sm font-bold text-white">
                S
              </span>
              Shabab
            </span>
            <AppNav items={nav} />
          </div>
          <SignOutButton />
        </div>
      </header>
      <ToastProvider>
        <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
      </ToastProvider>
    </div>
  );
}
