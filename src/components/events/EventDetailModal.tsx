"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateEvent, deleteEvent, updateEventStatus } from "@/actions/events";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { EVENT_TYPES, formatDate, formatTime, getEventStatusColor } from "@/lib/utils";
import type { EventType } from "@/lib/utils";
import type { BadgeColor, ParkOption } from "@/types";

interface EventDetailData {
  id: string;
  name: string;
  type: string;
  date: Date | string;
  endDate?: Date | string | null;
  startTime: string | null;
  endTime: string | null;
  status: string;
  isRecurring: boolean;
  park: { id: string; name: string };
  _count?: { attendances: number };
}

interface EventDetailModalProps {
  event: EventDetailData;
  open: boolean;
  onClose: () => void;
  parks: ParkOption[];
}

export default function EventDetailModal({ event, open, onClose, parks }: EventDetailModalProps) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [statusUpdating, setStatusUpdating] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

  const typeInfo = EVENT_TYPES[event.type as EventType] || EVENT_TYPES.custom;
  const dateStr = typeof event.date === "string" ? event.date : event.date.toISOString().split("T")[0];

  const [form, setForm] = useState({
    name: event.name,
    type: event.type,
    date: dateStr,
    endDate: event.endDate ? (typeof event.endDate === "string" ? event.endDate : new Date(event.endDate).toISOString().split("T")[0]) : "",
    startTime: event.startTime || "",
    endTime: event.endTime || "",
    parkId: event.park.id,
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const result = await updateEvent(event.id, {
        name: form.name,
        type: form.type,
        date: form.date,
        endDate: form.endDate || undefined,
        startTime: form.startTime || undefined,
        endTime: form.endTime || undefined,
        parkId: form.parkId,
        isRecurring: false,
      });

      if (result?.error) {
        toast(result.error, "error");
        setSaving(false);
        return;
      }

      toast("Event updated successfully");
      onClose();
      router.refresh();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setSaving(true);

    try {
      const result = await deleteEvent(event.id);

      if (result?.error) {
        toast(result.error, "error");
        setSaving(false);
        return;
      }

      toast("Event deleted");
      onClose();
      router.refresh();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(status: string) {
    setStatusUpdating(true);

    try {
      const result = await updateEventStatus(event.id, status);

      if (result?.error) {
        toast(result.error, "error");
        return;
      }

      toast(`Event marked as ${status}`);
      onClose();
      router.refresh();
    } catch {
      toast("Something went wrong", "error");
    } finally {
      setStatusUpdating(false);
    }
  }

  const editingFooter = editing ? (
    <div className="flex gap-3">
      <Button type="submit" form="edit-event-form" disabled={saving} className="flex-1">
        {saving ? "Saving..." : "Save Changes"}
      </Button>
      <Button type="button" variant="secondary" onClick={() => setEditing(false)}>
        Cancel
      </Button>
    </div>
  ) : undefined;

  return (
    <>
      <Modal open={open} onClose={onClose} title={editing ? "Edit Event" : event.name} footer={editingFooter}>
        {editing ? (
          <form id="edit-event-form" onSubmit={handleSave} className="space-y-4">
            <div>
              <label htmlFor="event-name" className="block text-sm font-medium text-gray-700 mb-1">Event Name *</label>
              <input
                id="event-name"
                required
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="event-type" className="block text-sm font-medium text-gray-700 mb-1">Event Type *</label>
              <select
                id="event-type"
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {Object.entries(EVENT_TYPES).map(([key, val]) => (
                  <option key={key} value={key}>{val.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="event-park" className="block text-sm font-medium text-gray-700 mb-1">Park *</label>
              <select
                id="event-park"
                required
                value={form.parkId}
                onChange={(e) => setForm({ ...form, parkId: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">Select park</option>
                {parks.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-date" className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  id="event-date"
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              {form.type === "camp" && (
                <div>
                  <label htmlFor="event-end-date" className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input
                    id="event-end-date"
                    type="date"
                    value={form.endDate}
                    onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="event-start-time" className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input
                  id="event-start-time"
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label htmlFor="event-end-time" className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input
                  id="event-end-time"
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Badge color={typeInfo.color as BadgeColor}>{typeInfo.label}</Badge>
              <Badge color={getEventStatusColor(event.status)}>{event.status}</Badge>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Park</span>
                <span className="text-gray-900">{event.park.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date</span>
                <span className="text-gray-900">{formatDate(event.date)}</span>
              </div>
              {event.startTime && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Time</span>
                  <span className="text-gray-900">
                    {formatTime(event.startTime)}
                    {event.endTime && ` - ${formatTime(event.endTime)}`}
                  </span>
                </div>
              )}
              {event._count && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Attendance Records</span>
                  <span className="text-gray-900">{event._count.attendances}</span>
                </div>
              )}
            </div>

            {/* Status change buttons */}
            {event.status === "scheduled" && (
              <div className="flex gap-2 pt-2 border-t border-gray-200">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange("completed")}
                >
                  Mark Completed
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange("cancelled")}
                >
                  Cancel Event
                </Button>
              </div>
            )}
            {event.status !== "scheduled" && (
              <div className="pt-2 border-t border-gray-200">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={statusUpdating}
                  onClick={() => handleStatusChange("scheduled")}
                >
                  Reopen as Scheduled
                </Button>
              </div>
            )}

            {/* Action buttons */}
            <div className="space-y-2 pt-2 border-t border-gray-200">
              <Link
                href={`/attendance?eventId=${event.id}`}
                className="flex items-center justify-center gap-2 w-full px-4 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Mark Attendance
              </Link>
              <Button variant="secondary" className="w-full" onClick={() => setEditing(true)}>
                Edit Event
              </Button>
              <Button variant="danger" className="w-full" onClick={() => setConfirmDelete(true)}>
                Delete Event
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={confirmDelete}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
        title="Delete Event"
        message={`Delete "${event.name}"? This will also remove all attendance records for this event. This cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </>
  );
}
