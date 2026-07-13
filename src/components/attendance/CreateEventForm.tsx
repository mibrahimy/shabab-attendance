"use client";

// Create-event modal: pick where, title, when, reach (direct vs whole subtree) and
// segment, with a LIVE roster-size preview so you see who's included before you
// create. POSTs to /api/events. The preview reuses the same server-side roster
// resolution as creation, so the count can't disagree with the result.

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Segmented";
import { useToast } from "@/components/ui/Toast";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-slate-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

function defaultLocalDateTime(): string {
  const d = new Date();
  d.setSeconds(0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type NodeOption = { id: string; name: string; label: string };

export function CreateEventForm({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { t } = useTranslation("attendance");
  const { toast } = useToast();
  const [nodes, setNodes] = useState<NodeOption[]>([]);
  const [nodeId, setNodeId] = useState("");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [when, setWhen] = useState(defaultLocalDateTime);
  const [segment, setSegment] = useState<"" | "junior" | "senior">("");
  const [reach, setReach] = useState<"direct" | "subtree">("direct");
  const [mode, setMode] = useState<"members" | "team">("members");
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState<number | null>(null);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    if (!open) return;
    void fetch("/api/events?nodes=1")
      .then((r) => r.json())
      .then((j) => {
        const ns: NodeOption[] = j?.data?.nodes ?? [];
        setNodes(ns);
        if (ns[0]) setNodeId(ns[0].id);
      })
      .catch(() => setNodes([]));
  }, [open]);

  // Live roster-size preview — debounced, stale-guarded, reuses the create path.
  useEffect(() => {
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      if (!nodeId) {
        setPreview(null);
        setPreviewing(false);
        return;
      }
      setPreviewing(true);
      const rd = reach === "subtree" ? "null" : "1";
      // Team mode ignores reach + segment (see submit); keep the preview consistent.
      const seg = mode === "members" ? segment : "";
      fetch(
        `/api/events?preview=1&nodeId=${encodeURIComponent(nodeId)}&rosterDepth=${rd}&segment=${seg}&rosterMode=${mode}`,
        { signal: ctrl.signal },
      )
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          setPreview(typeof j?.data?.count === "number" ? j.data.count : null);
          setPreviewing(false);
        })
        .catch(() => {});
    }, 300);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [nodeId, reach, segment, mode]);

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
          title: title.trim(),
          scheduledAt: new Date(when).toISOString(),
          rosterMode: mode,
          // Reach + segment only apply to a members roster; a team roster is the
          // node's leads regardless of these, so don't send them in team mode.
          ...(mode === "members"
            ? { segment: segment || undefined, rosterDepth: reach === "subtree" ? null : 1 }
            : {}),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? t("create.error", "Could not create event"), "error");
        return;
      }
      onCreated();
    } catch {
      toast(t("offline.networkError", "Network error"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("create.title")}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            {!nodeId ? (
              ""
            ) : previewing ? (
              <span className="text-slate-400">{t("create.previewLoading", "Counting…")}</span>
            ) : preview === null ? (
              ""
            ) : (
              <span>
                <span className="font-num font-semibold text-slate-700">{preview}</span>{" "}
                {t("create.preview", { count: preview, defaultValue: "people on this roster" })}
              </span>
            )}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {t("create.cancel", "Cancel")}
            </Button>
            <Button onClick={submit} loading={saving} disabled={!nodeId || !title.trim() || saving}>
              {t("create.submit")}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.node")}</label>
          {nodes.length > 8 && (
            <input
              value={query}
              onChange={(e) => {
                const v = e.target.value;
                setQuery(v);
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
              <option value="">{nodes.length === 0 ? t("create.nodePlaceholder") : t("create.noMatch")}</option>
            )}
            {filtered.map((n) => (
              <option key={n.id} value={n.id}>{n.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.name")}</label>
          <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.when")}</label>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={inputClass} />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.mode", "Whose attendance")}</label>
          <Segmented
            value={mode}
            onChange={setMode}
            fullWidth
            options={[
              { value: "members", label: t("create.modeMembers", "Members") },
              { value: "team", label: t("create.modeTeam", "Team (leads)") },
            ]}
          />
          {mode === "team" && (
            <p className="mt-1.5 text-xs text-slate-400">
              {t("create.teamHint", "The team here: this node's lead plus each sub-location's lead.")}
            </p>
          )}
        </div>

        {mode === "members" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.reach", "Who")}</label>
              <Segmented
                value={reach}
                onChange={setReach}
                fullWidth
                options={[
                  { value: "direct", label: t("create.reachDirect", "This group") },
                  { value: "subtree", label: t("create.reachSubtree", "Everyone under") },
                ]}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">{t("create.segment", "Segment")}</label>
              <Segmented
                value={segment}
                onChange={setSegment}
                fullWidth
                options={[
                  { value: "", label: t("create.segmentAll", "All") },
                  { value: "junior", label: t("create.segmentJunior", "Junior") },
                  { value: "senior", label: t("create.segmentSenior", "Senior") },
                ]}
              />
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
