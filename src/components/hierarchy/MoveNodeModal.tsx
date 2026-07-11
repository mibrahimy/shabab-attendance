"use client";

// Picks a new parent for a node being moved. Targets are pre-filtered to valid
// parents (one level above the node) by the caller; this just searches + confirms.

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";

export type MoveTarget = { id: string; name: string; pathLabel: string };

export function MoveNodeModal({
  nodeName,
  targets,
  saving,
  onSubmit,
  onClose,
}: {
  nodeName: string;
  targets: MoveTarget[];
  saving: boolean;
  onSubmit: (newParentId: string) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation("hierarchy");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const q = query.trim().toLowerCase();
  const filtered = q ? targets.filter((tg) => tg.pathLabel.toLowerCase().includes(q)) : targets;

  return (
    <Modal
      open
      onClose={onClose}
      title={t("move.title", { name: nodeName, defaultValue: `Move ${nodeName}` })}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("move.cancel", "Cancel")}
          </Button>
          <Button onClick={() => selected && onSubmit(selected)} loading={saving} disabled={!selected || saving}>
            {t("move.submit", "Move")}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-slate-500">{t("move.help", "Choose a new parent.")}</p>
      {targets.length > 8 && (
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("move.search", "Search…")}
          className="mb-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15"
        />
      )}
      <ul className="max-h-64 space-y-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <li className="px-2 py-6 text-center text-sm text-slate-400">{t("move.none", "No valid targets")}</li>
        ) : (
          filtered.map((tg) => (
            <li key={tg.id}>
              <button
                onClick={() => setSelected(tg.id)}
                className={`flex w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-start transition ${
                  selected === tg.id
                    ? "border-[#2f55ea] bg-[#2f55ea]/[0.06]"
                    : "border-slate-200/70 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium text-slate-900">{tg.name}</span>
                  <span className="block truncate text-xs text-slate-400">{tg.pathLabel}</span>
                </span>
                {selected === tg.id && <span className="shrink-0 text-[#2f55ea]" aria-hidden>✓</span>}
              </button>
            </li>
          ))
        )}
      </ul>
    </Modal>
  );
}
