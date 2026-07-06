// Authed home. Reached only by a signed-in, onboarded user (middleware enforces
// session + password-change first). A city admin lands on their city dashboard;
// others get quick links appropriate to their grants.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export default async function Home() {
  const ctx = await getAuthzContext();

  const managedCityId = ctx.isSuperadmin
    ? null
    : (ctx.grants.find((g) => g.permission === "manage_city" && g.cityId)?.cityId ?? null);

  const canMarkAttendance =
    ctx.isSuperadmin || ctx.grants.some((g) => g.permission === "mark_attendance");

  let summary: Awaited<ReturnType<typeof hierarchyService.getCitySummary>> | null = null;
  if (managedCityId) {
    try {
      summary = await hierarchyService.getCitySummary(ctx, managedCityId);
    } catch (err) {
      if (!(err instanceof ForbiddenError || err instanceof NotFoundError)) throw err;
    }
  }

  return (
    <HomeDashboard
      summary={summary}
      cityId={managedCityId}
      isSuperadmin={ctx.isSuperadmin}
      canMarkAttendance={canMarkAttendance}
    />
  );
}
