"use client";

// City structure editor — add / rename / reorder / recolor / remove the org tiers
// (levels) and set each level's head role. Levels flow straight into the hierarchy
// builder ("+ Add {level}") and the derived team roll-up.

import { useState } from "react";
import Link from "next/link";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import type { BadgeColor } from "@/types";
import type { StructurePayload, ManagedLevel } from "@/types/structure";

const asColor = (c: string | null): BadgeColor => (c ?? "gray") as BadgeColor;

// Solid swatch class per level color (for the color picker dots).
const SWATCH: Record<string, string> = {
  slate: "bg-slate-400", blue: "bg-blue-500", green: "bg-emerald-500", amber: "bg-amber-500",
  pink: "bg-pink-500", purple: "bg-purple-500", indigo: "bg-indigo-500", orange: "bg-orange-500",
  red: "bg-red-500", gray: "bg-gray-400",
};

export function LevelsEditor({ cityId, initial }: { cityId: string; initial: StructurePayload }) {
  const { toast } = useToast();
  const [data, setData] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<ManagedLevel | null>(null);
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.levels.map((l) => [l.id, l.label])),
  );

  const { levels, headRoleOptions, colorOptions } = data;

  async function reload() {
    const res = await fetch(`/api/cities/${cityId}/levels`);
    const json = await res.json().catch(() => ({}));
    if (res.ok) {
      const next: StructurePayload = json.data;
      setData(next);
      setNames(Object.fromEntries(next.levels.map((l) => [l.id, l.label])));
    }
  }

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setBusy(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast(j?.error?.message ?? "Something went wrong", "error");
        return false;
      }
      return true;
    } catch {
      toast("Network error", "error");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rename(l: ManagedLevel) {
    const name = (names[l.id] ?? "").trim();
    if (!name || name === l.label) return;
    if (await call(`/api/cities/${cityId}/levels/${l.id}`, "PATCH", { name })) {
      toast("Level renamed");
      await reload();
    }
  }
  async function setHead(l: ManagedLevel, headPositionKey: string | null) {
    if (await call(`/api/cities/${cityId}/levels/${l.id}`, "PATCH", { headPositionKey })) await reload();
  }
  async function setColor(l: ManagedLevel, color: string) {
    if (await call(`/api/cities/${cityId}/levels/${l.id}`, "PATCH", { color })) await reload();
  }
  async function move(l: ManagedLevel, dir: "up" | "down") {
    if (await call(`/api/cities/${cityId}/levels/${l.id}`, "PATCH", { move: dir })) await reload();
  }
  async function remove() {
    if (!removeTarget) return;
    if (await call(`/api/cities/${cityId}/levels/${removeTarget.id}`, "DELETE")) {
      toast("Level removed");
      setRemoveTarget(null);
      await reload();
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#2f55ea]">Administration</div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Levels</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            The tiers of your org tree, from the top down. Add or reorder them to match how you’re structured.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href={`/hierarchy/${cityId}`}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 transition hover:border-[#2f55ea]/40 hover:text-[#2f55ea]"
          >
            ‹ Hierarchy
          </Link>
          <Button onClick={() => setAdding(true)}>+ Add level</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        {/* City root — fixed, for orientation */}
        <div className="flex items-center gap-3 border-b border-slate-100 bg-slate-50/60 px-5 py-3">
          <Badge color="slate">City</Badge>
          <span className="text-sm font-medium text-slate-500">The city is the root — levels below it are yours to shape.</span>
        </div>
        <ul className="divide-y divide-slate-100">
          {levels.map((l, i) => (
            <li key={l.id} className="flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-4">
              {/* reorder */}
              <div className="flex flex-col">
                <button
                  onClick={() => move(l, "up")}
                  disabled={busy || i === 0}
                  aria-label="Move up"
                  className="px-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-25"
                >▲</button>
                <button
                  onClick={() => move(l, "down")}
                  disabled={busy || i === levels.length - 1}
                  aria-label="Move down"
                  className="px-1 text-slate-400 transition hover:text-slate-700 disabled:opacity-25"
                >▼</button>
              </div>

              {/* color + name */}
              <Badge color={asColor(l.color)}>{l.label}</Badge>
              <input
                value={names[l.id] ?? ""}
                onChange={(e) => setNames((m) => ({ ...m, [l.id]: e.target.value }))}
                onBlur={() => rename(l)}
                onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                className="min-w-[8rem] flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-medium text-slate-900 outline-none transition hover:border-slate-200 focus:border-[#2f55ea] focus:bg-white focus:ring-2 focus:ring-[#2f55ea]/15"
              />

              {/* head role */}
              <label className="flex items-center gap-1.5 text-xs text-slate-400">
                head
                <select
                  value={l.headPositionKey ?? ""}
                  onChange={(e) => setHead(l, e.target.value || null)}
                  disabled={busy}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 outline-none focus:border-[#2f55ea]"
                >
                  <option value="">none</option>
                  {headRoleOptions.map((r) => (
                    <option key={r.key} value={r.key}>{r.label}</option>
                  ))}
                </select>
              </label>

              {/* color swatches */}
              <div className="flex items-center gap-1">
                {colorOptions.map((c) => (
                  <button
                    key={c}
                    onClick={() => setColor(l, c)}
                    aria-label={`Color ${c}`}
                    className={`h-4 w-4 rounded-full ring-2 ring-offset-1 transition ${SWATCH[c] ?? "bg-gray-400"} ${l.color === c ? "ring-slate-900" : "ring-transparent hover:ring-slate-300"}`}
                  >
                    <span className="sr-only">{c}</span>
                  </button>
                ))}
              </div>

              {/* node count + delete */}
              <span className="font-num text-xs text-slate-400">{l.nodeCount} node{l.nodeCount === 1 ? "" : "s"}</span>
              <button
                onClick={() => setRemoveTarget(l)}
                disabled={busy || l.nodeCount > 0}
                title={l.nodeCount > 0 ? "This level has nodes — remove them first" : "Remove level"}
                className="rounded-lg px-2 py-1 text-xs font-medium text-rose-500 transition hover:bg-rose-50 disabled:opacity-30"
              >
                Remove
              </button>
            </li>
          ))}
          {levels.length === 0 && (
            <li className="px-5 py-10 text-center text-sm text-slate-400">No levels yet — add your first tier.</li>
          )}
        </ul>
      </div>

      {adding && (
        <AddLevelModal
          levels={levels}
          headRoleOptions={headRoleOptions}
          colorOptions={colorOptions}
          busy={busy}
          onClose={() => setAdding(false)}
          onSubmit={async (payload) => {
            if (await call(`/api/cities/${cityId}/levels`, "POST", payload)) {
              toast("Level added");
              setAdding(false);
              await reload();
            }
          }}
        />
      )}

      <ConfirmDialog
        open={!!removeTarget}
        title={removeTarget ? `Remove “${removeTarget.label}”?` : "Remove level"}
        message="This tier will be removed from the city. Nodes and roles are unaffected."
        confirmLabel="Remove"
        variant="danger"
        loading={busy}
        onConfirm={remove}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}

function AddLevelModal({
  levels, headRoleOptions, colorOptions, busy, onClose, onSubmit,
}: {
  levels: ManagedLevel[];
  headRoleOptions: { key: string; label: string }[];
  colorOptions: string[];
  busy: boolean;
  onClose: () => void;
  onSubmit: (p: { name: string; afterLevelId: string | null; color: string; headPositionKey: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [afterLevelId, setAfterLevelId] = useState<string>(levels.length ? levels[levels.length - 1].id : "");
  const [color, setColor] = useState(colorOptions[1] ?? "blue");
  const [headPositionKey, setHeadPositionKey] = useState<string>("");
  const input = "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15";

  return (
    <Modal
      open
      onClose={onClose}
      title="Add level"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={busy}
            disabled={!name.trim() || busy}
            onClick={() => onSubmit({ name: name.trim(), afterLevelId: afterLevelId || null, color, headPositionKey: headPositionKey || null })}
          >
            Add level
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Name</label>
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Region" className={input} />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Position</label>
          <select value={afterLevelId} onChange={(e) => setAfterLevelId(e.target.value)} className={input}>
            <option value="">Top (right under the city)</option>
            {levels.map((l) => (
              <option key={l.id} value={l.id}>After {l.label}</option>
            ))}
          </select>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Head role</label>
            <select value={headPositionKey} onChange={(e) => setHeadPositionKey(e.target.value)} className={input}>
              <option value="">None</option>
              {headRoleOptions.map((r) => (
                <option key={r.key} value={r.key}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Color</label>
            <select value={color} onChange={(e) => setColor(e.target.value)} className={input}>
              {colorOptions.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
    </Modal>
  );
}
