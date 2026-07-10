// City attendance report (RSC). Calls the service in-process; a ForbiddenError
// (no view_attendance on this city) renders as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as reportService from "@/server/services/report-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { ReportView } from "@/components/reports/ReportView";

export default async function ReportsPage({ params }: { params: Promise<{ cityId: string }> }) {
  const { cityId } = await params;
  const ctx = await getAuthzContext();

  let report: Awaited<ReturnType<typeof reportService.getCityReport>>;
  try {
    report = await reportService.getCityReport(ctx, cityId);
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

  return <ReportView report={report} />;
}
