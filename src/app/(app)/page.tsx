// Authed home. Reached only by a signed-in, onboarded user (middleware enforces
// session + password-change first). Superadmins get a link into the org tree.

import Link from "next/link";
import { getAuthzContext } from "@/server/auth/authz-context";

export default async function Home() {
  const ctx = await getAuthzContext();

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 text-center">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-gray-900">
          You’re signed in{ctx.isSuperadmin ? " as a superadmin" : ""}
        </h1>
        <p className="mt-2 text-sm text-gray-500">
          {ctx.grants.length} permission grant{ctx.grants.length === 1 ? "" : "s"} resolved for this
          session.
        </p>
      </div>
      {ctx.isSuperadmin && (
        <Link
          href="/cities"
          className="rounded-xl bg-[#2f55ea] px-5 py-2.5 text-sm font-medium text-white transition hover:bg-[#2546c9]"
        >
          Manage countries & cities
        </Link>
      )}
    </div>
  );
}
