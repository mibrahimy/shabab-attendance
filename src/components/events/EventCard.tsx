import Badge from "@/components/ui/Badge";
import { EVENT_TYPES, formatDate, formatTime, getEventStatusColor } from "@/lib/utils";
import type { EventType } from "@/lib/utils";
import type { BadgeColor } from "@/types";

interface EventCardProps {
  event: {
    id: string;
    name: string;
    type: string;
    date: Date | string;
    startTime: string | null;
    endTime: string | null;
    status: string;
    isRecurring: boolean;
    park: { name: string };
    _count?: { attendances: number };
  };
}

export default function EventCard({ event }: EventCardProps) {
  const typeInfo = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.custom;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-gray-900">{event.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">{event.park.name}</p>
        </div>
        <Badge color={typeInfo.color as BadgeColor}>
          {typeInfo.label}
        </Badge>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500 mt-3">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          {formatDate(event.date)}
        </span>
        {event.startTime && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatTime(event.startTime)}
            {event.endTime && ` - ${formatTime(event.endTime)}`}
          </span>
        )}
        {event.isRecurring && (
          <span className="flex items-center gap-1">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Recurring
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <Badge color={getEventStatusColor(event.status)}>
          {event.status}
        </Badge>
        {event._count && (
          <span className="text-xs text-gray-500">
            {event._count.attendances} attendance records
          </span>
        )}
      </div>
    </div>
  );
}
