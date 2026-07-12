// Hierarchy builder page (RSC). Calls the service in-process (§12); the service's
// permission check throws ForbiddenError for anyone outside the city's scope,
// which we render as a friendly panel.

import Link from "next/link";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { HierarchyWorkspace } from "@/components/hierarchy/HierarchyWorkspace";

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
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">
            Administration
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Hierarchy</h1>
          <p className="mt-0.5 text-sm text-slate-500">{tree.city.name} · structure &amp; people</p>
        </div>
        <Link
          href={`/hierarchy/${cityId}/levels`}
          className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2f55ea]/40 hover:text-[#2f55ea]"
        >
          Manage levels
        </Link>
      </div>
      <HierarchyWorkspace
        city={{ id: tree.city.id, name: tree.city.name }}
        levels={tree.levels}
        nodes={tree.nodes}
        roles={tree.roles}
      />
    </div>
  );
}
