// Roles editor page (RSC). Calls the service in-process; a ForbiddenError (no
// manage_city for this city) renders as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as rolesService from "@/server/services/roles-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { RolesEditor } from "@/components/roles/RolesEditor";
import { getLocale } from "@/i18n/get-locale";
import { getServerI18n } from "@/i18n/server";

export default async function RolesPage({
  params,
}: {
  params: Promise<{ cityId: string }>;
}) {
  const { cityId } = await params;
  const ctx = await getAuthzContext();
  const { t } = await getServerI18n(await getLocale(), "roles");

  let payload: Awaited<ReturnType<typeof rolesService.listRoles>>;
  try {
    payload = await rolesService.listRoles(ctx, cityId);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          {t("page.noAccess")}
        </div>
      );
    }
    throw err;
  }

  return (
    <div>
      <p className="mb-1 text-sm text-gray-500">{t("page.eyebrow")}</p>
      <h1 className="mb-1 text-xl font-semibold tracking-tight text-gray-900">{t("page.title")}</h1>
      <p className="mb-5 text-sm text-gray-500">{t("page.description")}</p>
      <RolesEditor cityId={cityId} permissions={payload.permissions} roles={payload.roles} />
    </div>
  );
}
