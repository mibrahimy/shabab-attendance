"use client";

import { useState, useMemo } from "react";
import Button from "@/components/ui/Button";
import EmptyState from "@/components/ui/EmptyState";
import EventCard from "@/components/events/EventCard";
import CreateEventModal from "@/components/events/CreateEventModal";
import EventDetailModal from "@/components/events/EventDetailModal";
import { EVENT_TYPES, type EventType } from "@/lib/utils";
import type { ParkOption } from "@/types";

interface EventData {
  id: string;
  name: string;
  type: string;
  date: Date;
  endDate?: Date | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  isRecurring: boolean;
  park: ParkOption;
  _count: { attendances: number };
}

interface EventsClientProps {
  events: EventData[];
  parks: ParkOption[];
}

type DateFilter = "upcoming" | "this_week" | "this_month" | "past" | "all";

const DATE_FILTER_LABELS: Record<DateFilter, string> = {
  upcoming: "Upcoming",
  this_week: "This Week",
  this_month: "This Month",
  past: "Past",
  all: "All",
};

function matchesDateFilter(date: Date, df: DateFilter): boolean {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const eventDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  switch (df) {
    case "upcoming":
      return eventDay >= today;
    case "this_week": {
      const weekOut = new Date(today);
      weekOut.setDate(today.getDate() + 7);
      return eventDay >= today && eventDay <= weekOut;
    }
    case "this_month":
      return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth();
    case "past":
      return eventDay < today;
    case "all":
      return true;
  }
}

export default function EventsClient({ events, parks }: EventsClientProps) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);
  const [dateFilter, setDateFilter] = useState<DateFilter>("upcoming");
  const [filter, setFilter] = useState<"all" | "scheduled" | "completed">("all");
  const [parkFilter, setParkFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (!matchesDateFilter(new Date(e.date), dateFilter)) return false;
      if (filter !== "all" && e.status !== filter) return false;
      if (parkFilter && e.park.id !== parkFilter) return false;
      if (typeFilter && e.type !== typeFilter) return false;
      return true;
    });
  }, [events, dateFilter, filter, parkFilter, typeFilter]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Events</h1>
        <Button onClick={() => setShowCreate(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Create Event
        </Button>
      </div>

      <div className="space-y-2 mb-4">
        {/* Date range pills */}
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
          {(Object.keys(DATE_FILTER_LABELS) as DateFilter[]).map((df) => (
            <button
              key={df}
              onClick={() => setDateFilter(df)}
              className={`shrink-0 px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                dateFilter === df
                  ? "bg-[var(--accent-light)] text-[var(--accent-text)]"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {DATE_FILTER_LABELS[df]}
            </button>
          ))}
        </div>

        {/* Status + dropdowns */}
        <div className="flex flex-wrap items-center gap-2">
          {(["all", "scheduled", "completed"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium min-h-[44px] lg:min-h-0 transition-colors ${
                filter === f
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}

          <div className="flex gap-2 ml-auto">
            <select
              value={parkFilter}
              onChange={(e) => setParkFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Parks</option>
              {parks.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {Object.entries(EVENT_TYPES).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <EmptyState
          title="No events found"
          description={filter === "all" ? "Create your first event to get started." : `No ${filter} events.`}
          icon={
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          }
          action={
            filter === "all" ? (
              <Button onClick={() => setShowCreate(true)} size="sm">
                Create Event
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="grid lg:grid-cols-2 xl:grid-cols-3 gap-3 lg:gap-4">
          {filteredEvents.map((event) => (
            <EventCard
              key={event.id}
              event={event}
              onClick={() => setSelectedEvent(event)}
            />
          ))}
        </div>
      )}

      <CreateEventModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        parks={parks}
      />

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          open={true}
          onClose={() => setSelectedEvent(null)}
          parks={parks}
        />
      )}
    </div>
  );
}
