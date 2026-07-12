// Node-scoped attendance report (RSC) — drill into a zone / park / class subtree
// from the city report's by-location table. Scoped by view_attendance on the node.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as reportService from "@/server/services/report-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { ReportView } from "@/components/reports/ReportView";

const PERIODS: Record<string, number | null> = { all: null, "30": 30, "90": 90, "365": 365 };

function rangeForPeriod(period: string): { start: Date; end: Date } | undefined {
  const days = PERIODS[period] ?? null;
  if (!days) return undefined;
  const now = Date.now();
  return { start: new Date(now - days * 86400e3), end: new Date(now + 86400e3) };
}

export default async function NodeReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ cityId: string; nodeId: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { cityId, nodeId } = await params;
  const period = (await searchParams).period ?? "all";
  const range = rangeForPeriod(period);
  const ctx = await getAuthzContext();

  let report: Awaited<ReturnType<typeof reportService.getNodeReport>>;
  try {
    report = await reportService.getNodeReport(ctx, nodeId, range);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to this location’s report.
        </div>
      );
    }
    throw err;
  }

  return (
    <ReportView
      report={report}
      cityId={cityId}
      period={period}
      nodeId={nodeId}
      trail={report.trail}
      people={report.people}
      peopleTruncated={report.peopleTruncated}
      basePath={`/reports/${cityId}/node/${nodeId}`}
      csvName={report.node.name}
      heading={{
        title: report.node.name,
        subtitle: `${report.node.level} · attendance`,
      }}
    />
  );
}
