// City attendance report (RSC). Calls the service in-process; a ForbiddenError
// (no view_attendance on this city) renders as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as reportService from "@/server/services/report-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { ReportView } from "@/components/reports/ReportView";

// Period presets → a day window (null = all time).
const PERIODS: Record<string, number | null> = { all: null, "30": 30, "90": 90, "365": 365 };

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ cityId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { cityId } = await params;
  const period = (await searchParams).period ?? "all";
  const days = PERIODS[period] ?? null;
  const range = days ? { start: new Date(Date.now() - days * 86400e3), end: new Date(Date.now() + 86400e3) } : undefined;
  const ctx = await getAuthzContext();

  let report: Awaited<ReturnType<typeof reportService.getCityReport>>;
  try {
    report = await reportService.getCityReport(ctx, cityId, range);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to this city’s reports.
        </div>
      );
    }
    throw err;
  }

  return <ReportView report={report} cityId={cityId} period={period} />;
}
