// Roles editor page (RSC). Calls the service in-process; a ForbiddenError (no
// manage_city for this city) renders as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as rolesService from "@/server/services/roles-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { RolesEditor } from "@/components/roles/RolesEditor";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = await params;
  const ctx = await getAuthzContext();

  let payload: Awaited<ReturnType<typeof rolesService.listRoles>>;
  try {
    payload = await rolesService.listRoles(ctx, cityId);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to manage this city’s roles.
        </div>
      );
    }
    throw err;
  }

  return (
    <div>
      <p className="mb-1 text-sm text-gray-500">Roles</p>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-gray-900">Manage roles</h1>
      <p className="mb-5 text-sm text-gray-500">
        Choose what each role can do in this city. Changes apply the next time the holder acts.
      </p>
      <RolesEditor cityId={cityId} permissions={payload.permissions} roles={payload.roles} />
    </div>
  );
}
