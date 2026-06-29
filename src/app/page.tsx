// v2 authenticated landing. Middleware already guarantees a valid session before
// this renders (unauth → /login, mustChangePassword → /change-password), so this
// is only reached by a signed-in, onboarded user. The real dashboard arrives in a
// later phase; for now this proves the per-request AuthzContext loads and gives a
// way to sign out.

import { getAuthzContext } from "@/server/auth/authz-context";
import { SignOutButton } from "@/components/auth/SignOutButton";

export default async function Home() {
  const ctx = await getAuthzContext();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-[#f4f3ff] px-4 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          You’re signed in{ctx.isSuperadmin ? " as a superadmin" : ""}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          The dashboard is coming in a later phase. Authentication and permissions are live.
        </p>
        <p className="mt-1 text-xs text-gray-400">
          {ctx.grants.length} permission grant{ctx.grants.length === 1 ? "" : "s"} resolved for this
          session.
        </p>
      </div>
      <SignOutButton />
    </div>
  );
}
