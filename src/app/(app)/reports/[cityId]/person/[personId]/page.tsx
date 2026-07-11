// Per-person attendance report (RSC). Scoped by view_attendance on the person's
// city; a Forbidden/NotFound renders as a friendly panel.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as reportService from "@/server/services/report-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { PersonReportView } from "@/components/reports/PersonReportView";

export default async function PersonReportPage({
  params,
}: {
  params: Promise<{ cityId: string; personId: string }>;
}) {
  const { cityId, personId } = await params;
  const ctx = await getAuthzContext();

  let report: Awaited<ReturnType<typeof reportService.getPersonReport>>;
  try {
    report = await reportService.getPersonReport(ctx, personId);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to this person’s attendance.
        </div>
      );
    }
    throw err;
  }

  return <PersonReportView report={report} cityId={cityId} />;
}
