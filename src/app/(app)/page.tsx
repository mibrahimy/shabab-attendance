// Authed home = the command-center dashboard. A city admin sees their city; a
// superadmin defaults to the first city (so the landing is never empty). Users
// with neither get quick links appropriate to their grants.

import { cookies } from "next/headers";
import { getAuthzContext } from "@/server/auth/authz-context";
import * as hierarchyService from "@/server/services/hierarchy-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { HomeDashboard } from "@/components/home/HomeDashboard";

export default async function Home() {
  const ctx = await getAuthzContext();
  const preferredCity = (await cookies()).get("sb_city")?.value ?? null;
  const cityId = await hierarchyService.getDefaultCityId(ctx, preferredCity);
  const canMarkAttendance =
    ctx.isSuperadmin || ctx.grants.some((g) => g.permission === "mark_attendance");

  let dashboard: Awaited<ReturnType<typeof hierarchyService.getCityDashboard>> | null = null;
  if (cityId) {
    try {
      dashboard = await hierarchyService.getCityDashboard(ctx, cityId);
    } catch (err) {
      if (!(err instanceof ForbiddenError || err instanceof NotFoundError)) throw err;
    }
  }

  return (
    <HomeDashboard
      dashboard={dashboard}
      cityId={cityId}
      isSuperadmin={ctx.isSuperadmin}
      canMarkAttendance={canMarkAttendance}
    />
  );
}
