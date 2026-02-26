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
  onClick?: () => void;
}

export default function EventCard({ event, onClick }: EventCardProps) {
  const typeInfo = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.custom;

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-4 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-left w-full cursor-pointer active:scale-[0.98]"
    >
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
    </button>
  );
}
