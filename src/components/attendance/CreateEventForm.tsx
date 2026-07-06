"use client";

// Minimal create-event form (Chunk 1 proof). Picks a class the caller may create
// at (their create_event nodes), a title, and a date/time; POSTs to /api/events.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

function defaultLocalDateTime(): string {
  // now, rounded to the minute, in the input's local-datetime format
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const [nodes, setNodes] = useState<{ id: string; name: string }[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultLocalDateTime);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/events?nodes=1")
      .then((r) => r.json())
      .then((j) => {
        const ns = j?.data?.nodes ?? [];
        setNodes(ns);
        if (ns[0]) setNodeId(ns[0].id);
      })
      .catch(() => setNodes([]));
  }, []);

  async function submit() {
    if (!nodeId || !title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nodeId,
          title,
          scheduledAt: new Date(when).toISOString(),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? "Could not create event", "error");
        return;
      }
      onCreated();
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3 rounded-2xl border border-gray-200 bg-white p-4">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("create.node")}</label>
        <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={inputClass}>
          {nodes.length === 0 && <option value="">{t("create.nodePlaceholder")}</option>}
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("create.name")}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
      </div>
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("create.when")}</label>
        <input
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          className={inputClass}
        />
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} loading={saving} disabled={!nodeId || !title.trim() || saving}>
          {t("create.submit")}
        </Button>
      </div>
    </div>
  );
}
