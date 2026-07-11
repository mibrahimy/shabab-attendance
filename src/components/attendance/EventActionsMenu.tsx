"use client";

// Per-event actions (⋯) for a scheduled event: edit title/time, or cancel it.
// Edits go to PATCH /api/events/[id]; cancel (soft) to DELETE. The caller reloads
// on change. Node / audience are not editable — changing them would orphan marks.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

function toLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function EventActionsMenu({
  event,
  onChanged,
}: {
  event: { id: string; title: string; scheduledAt: string };
  onChanged: () => void;
}) {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [title, setTitle] = useState(event.title);
  const [when, setWhen] = useState(() => toLocalInput(event.scheduledAt));
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close the dropdown on an outside click.
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [menuOpen]);

  function openEdit() {
    setTitle(event.title);
    setWhen(toLocalInput(event.scheduledAt));
    setMenuOpen(false);
    setEditing(true);
  }

  async function saveEdit() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), scheduledAt: new Date(when).toISOString() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? t("actions.editError", "Could not update event"), "error");
        return;
      }
      toast(t("actions.updated", "Event updated"));
      setEditing(false);
      onChanged();
    } catch {
      toast(t("offline.networkError", "Network error"), "error");
    } finally {
      setSaving(false);
    }
  }

  async function doCancel() {
    setCancelling(true);
    try {
      const res = await fetch(`/api/events/${event.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? t("actions.cancelError", "Could not cancel event"), "error");
        return;
      }
      toast(t("actions.cancelled", "Event cancelled"));
      setConfirmCancel(false);
      onChanged();
    } catch {
      toast(t("offline.networkError", "Network error"), "error");
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="relative" ref={rootRef}>
      <button
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={t("actions.menu", "Event actions")}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="grid h-9 w-9 place-items-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
      >
        <span className="text-lg leading-none" aria-hidden>⋯</span>
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute end-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-[0_8px_24px_rgba(16,24,40,0.12)]"
        >
          <button
            role="menuitem"
            onClick={openEdit}
            className="block w-full px-4 py-2 text-start text-sm text-slate-700 hover:bg-slate-50"
          >
            {t("actions.edit", "Edit details")}
          </button>
          <button
            role="menuitem"
            onClick={() => { setMenuOpen(false); setConfirmCancel(true); }}
            className="block w-full px-4 py-2 text-start text-sm text-rose-600 hover:bg-rose-50"
          >
            {t("actions.cancel", "Cancel event")}
          </button>
        </div>
      )}

      <Modal
        open={editing}
        onClose={() => setEditing(false)}
        title={t("actions.editTitle", "Edit event")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setEditing(false)}>
              {t("create.cancel", "Cancel")}
            </Button>
            <Button onClick={saveEdit} loading={saving} disabled={!title.trim() || saving}>
              {t("actions.save", "Save changes")}
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.name")}</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.when")}</label>
            <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmCancel}
        title={t("actions.cancelConfirmTitle", "Cancel this event?")}
        message={t("actions.cancelConfirmMessage", "Attendance already recorded is kept, but the event becomes read-only.")}
        confirmLabel={t("actions.cancelConfirm", "Cancel event")}
        variant="danger"
        loading={cancelling}
        onConfirm={doCancel}
        onCancel={() => setConfirmCancel(false)}
      />
    </div>
  );
}
