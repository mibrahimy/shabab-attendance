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

type NodeOption = { id: string; name: string; label: string };

export function CreateEventForm({ onCreated }: { onCreated: () => void }) {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultLocalDateTime);
  const [segment, setSegment] = useState<"" | "junior" | "senior">("");
  const [reach, setReach] = useState<"direct" | "subtree">("direct");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/events?nodes=1")
      .then((r) => r.json())
      .then((j) => {
        const ns: NodeOption[] = j?.data?.nodes ?? [];
        setNodes(ns);
        if (ns[0]) setNodeId(ns[0].id);
      })
      .catch(() => setNodes([]));
  }, []);

  // The picker can hold the whole subtree for a high-level admin — filter by the
  // readable path label so a specific class is quick to find.
  const q = query.trim().toLowerCase();
  const filtered = q ? nodes.filter((n) => n.label.toLowerCase().includes(q)) : nodes;

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
          segment: segment || undefined,
          // "direct" = just this group's members; "subtree" = everyone underneath.
          rosterDepth: reach === "subtree" ? null : 1,
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
        {nodes.length > 8 && (
          <input
            value={query}
            onChange={(e) => {
              const v = e.target.value;
              setQuery(v);
              // Keep the selection on a visible option as the list narrows.
              const vq = v.trim().toLowerCase();
              const next = vq ? nodes.filter((n) => n.label.toLowerCase().includes(vq)) : nodes;
              if (!next.some((n) => n.id === nodeId)) setNodeId(next[0]?.id ?? "");
            }}
            placeholder={t("create.search")}
            className={`${inputClass} mb-2`}
          />
        )}
        <select value={nodeId} onChange={(e) => setNodeId(e.target.value)} className={inputClass}>
          {filtered.length === 0 && (
            <option value="">
              {nodes.length === 0 ? t("create.nodePlaceholder") : t("create.noMatch")}
            </option>
          )}
          {filtered.map((n) => (
            <option key={n.id} value={n.id}>
              {n.label}
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

      {/* Audience */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.reach", "Who")}</label>
          <select value={reach} onChange={(e) => setReach(e.target.value as "direct" | "subtree")} className={inputClass}>
            <option value="direct">{t("create.reachDirect", "This group’s members")}</option>
            <option value="subtree">{t("create.reachSubtree", "Everyone underneath")}</option>
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.segment", "Segment")}</label>
          <select value={segment} onChange={(e) => setSegment(e.target.value as "" | "junior" | "senior")} className={inputClass}>
            <option value="">{t("create.segmentAll", "All")}</option>
            <option value="junior">{t("create.segmentJunior", "Junior")}</option>
            <option value="senior">{t("create.segmentSenior", "Senior")}</option>
          </select>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} loading={saving} disabled={!nodeId || !title.trim() || saving}>
          {t("create.submit")}
        </Button>
      </div>
    </div>
  );
}
