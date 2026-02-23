import Badge from "@/components/ui/Badge";
import Card from "@/components/ui/Card";
import { getInitials, getAttendanceStatusColor } from "@/lib/utils";
import type { AttendanceSummary } from "@/types";

interface AttendanceRecord {
  id: string;
  status: string;
  member: { id: string; name: string; classAssignment: string | null };
  markedBy?: { name: string } | null;
}

interface AttendanceReportProps {
  records: AttendanceRecord[];
  summary: AttendanceSummary;
}

export default function AttendanceReport({ records, summary }: AttendanceReportProps) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold text-gray-900">{summary.rate}%</p>
          <p className="text-xs text-gray-500">Rate</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold text-green-600">{summary.present}</p>
          <p className="text-xs text-gray-500">Present</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold text-red-600">{summary.absent}</p>
          <p className="text-xs text-gray-500">Absent</p>
        </Card>
        <Card className="!p-3 text-center">
          <p className="text-2xl font-semibold text-amber-600">{summary.excused}</p>
          <p className="text-xs text-gray-500">Excused</p>
        </Card>
      </div>

      <Card>
        <div className="space-y-2">
          {records.map((record) => (
            <div
              key={record.id}
              className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium">
                  {getInitials(record.member.name)}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {record.member.name}
                  </p>
                  {record.member.classAssignment && (
                    <p className="text-xs text-gray-500">
                      {record.member.classAssignment}
                    </p>
                  )}
                </div>
              </div>
              <Badge color={getAttendanceStatusColor(record.status)}>
                {record.status}
              </Badge>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
