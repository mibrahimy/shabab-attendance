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
    <div className="space-y-6">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">
          {t("page.eyebrow")}
        </div>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">{t("page.title")}</h1>
        <p className="mt-0.5 text-sm text-slate-500">{t("page.description")}</p>
      </div>
      <RolesEditor cityId={cityId} permissions={payload.permissions} roles={payload.roles} />
    </div>
  );
}
