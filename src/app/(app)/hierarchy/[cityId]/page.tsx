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
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to this city’s hierarchy.
        </div>
      );
    }
    throw err;
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">
          Administration
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hierarchy</h1>
        <p className="mt-0.5 text-sm text-slate-500">{tree.city.name} · structure &amp; people</p>
      </div>
      <HierarchyBuilder
        city={{ id: tree.city.id, name: tree.city.name }}
        levels={tree.levels}
        nodes={tree.nodes}
        roles={tree.roles}
      />
    </div>
  );
}
