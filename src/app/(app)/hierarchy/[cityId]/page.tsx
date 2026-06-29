// Hierarchy builder page (RSC). Calls the service in-process (§12); the service's
// permission check throws ForbiddenError for anyone outside the city's scope,
// which we render as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { HierarchyBuilder } from "@/components/hierarchy/HierarchyBuilder";

export default async function HierarchyPage({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = await params;
  const ctx = await getAuthzContext();

  let tree: Awaited<ReturnType<typeof hierarchyService.getCityTree>>;
  try {
    tree = await hierarchyService.getCityTree(ctx, cityId);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to this city’s hierarchy.
        </div>
      );
    }
    throw err;
  }

  return (
    <div>
      <p className="mb-1 text-sm text-gray-500">Hierarchy</p>
      <HierarchyBuilder
        city={{ id: tree.city.id, name: tree.city.name }}
        levels={tree.levels}
        nodes={tree.nodes}
      />
    </div>
  );
}
