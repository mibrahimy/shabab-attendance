// City levels editor (RSC). Manage the org tiers below the city. Scoped by
// manage_city; a Forbidden/NotFound renders as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as structureService from "@/server/services/structure-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { LevelsEditor } from "@/components/structure/LevelsEditor";

export default async function LevelsPage({ params }: { params: Promise<{ cityId: string }> }) {
  const { cityId } = await params;
  const ctx = await getAuthzContext();

  let data: Awaited<ReturnType<typeof structureService.listLevels>>;
  try {
    data = await structureService.listLevels(ctx, cityId);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to manage this city’s structure.
        </div>
      );
    }
    throw err;
  }

  return <LevelsEditor cityId={cityId} initial={data} />;
}
