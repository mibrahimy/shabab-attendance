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

const TYPE_COLORS: Record<string, string> = {
  blue: "#3b82f6", green: "#22c55e", amber: "#f59e0b", purple: "#a855f7",
  indigo: "#6366f1", orange: "#f97316", pink: "#ec4899", slate: "#64748b",
};

export default function EventCard({ event, onClick }: EventCardProps) {
  const typeInfo = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.custom;
  const typeDotColor = TYPE_COLORS[typeInfo.color] ?? "#64748b";

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-4 hover:border-gray-300 transition-colors duration-150 text-left w-full cursor-pointer active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-medium text-gray-900 truncate">{event.name}</h3>
          <p className="text-xs text-gray-500 mt-0.5">
            <span className="font-medium" style={{ color: typeDotColor }}>{typeInfo.label}</span>
            {" · "}
            {event.park.name}
          </p>
        </div>
        <Badge color={getEventStatusColor(event.status)}>
          {event.status}
        </Badge>
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500">
        <div className="flex items-center gap-3">
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
              {event.endTime && ` – ${formatTime(event.endTime)}`}
            </span>
          )}
        </div>
        {event._count && (
          <span>{event._count.attendances} attended</span>
        )}
      </div>
    </button>
  );
}
