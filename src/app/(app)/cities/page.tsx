// Cities page (RSC). Calls the service in-process (§12 — no HTTP hop) to list the
// country/city tree, then hands it to the client manager for the create flows.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as orgService from "@/server/services/org-service";
import { CitiesManager } from "@/components/org/CitiesManager";

export default async function CitiesPage() {
  const ctx = await getAuthzContext();

  if (!ctx.isSuperadmin) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
        You don’t have access to manage countries and cities.
      </div>
    );
  }

  const countries = await orgService.listOrg(ctx);
  return <CitiesManager countries={countries} />;
}
