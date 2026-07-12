"use client";

// Move a member to another node/role. Pick a role, then a target node valid for
// that role's level (candidates come from the city tree already loaded client-side).

import { useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { nodesForRole, type RoleDef } from "@/lib/default-roles";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

export type MoveTarget = { id: string; name: string; level: { key: string } };

export function MoveMemberModal({
  member,
  roles,
  nodes,
  onClose,
  onMoved,
}: {
  member: { assignmentId: string; name: string } | null; // non-null = open
  roles: RoleDef[];
  nodes: MoveTarget[];
  onClose: () => void;
  onMoved: (targetNodeId: string) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation("hierarchy");
  const [roleKey, setRoleKey] = useState(roles[0]?.canonicalKey ?? "");
  const [targetNodeId, setTargetNodeId] = useState("");
  const [saving, setSaving] = useState(false);

  const role = roles.find((r) => r.canonicalKey === roleKey) ?? roles[0];
  const candidates = role ? nodesForRole(nodes, role) : [];
  const canSubmit = !!targetNodeId && !saving;

  async function submit() {
    if (!member || !role) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/assignments/${member.assignmentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetNodeId, roleKey: role.canonicalKey }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? t("toast.couldNotMove"), "error");
        return;
      }
      toast(t("toast.moved", { name: member.name }));
      onMoved(targetNodeId);
    } catch {
      toast(t("toast.networkError"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!member}
      onClose={onClose}
      title={member ? t("member.move.title", { name: member.name }) : t("member.move.titleFallback")}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            {t("modal.cancel")}
          </Button>
          <Button onClick={submit} loading={saving} disabled={!canSubmit}>
            {t("member.move.submit")}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("member.fields.role")}</label>
          <select
            value={roleKey}
            onChange={(e) => {
              setRoleKey(e.target.value);
              setTargetNodeId("");
            }}
            className={inputClass}
          >
            {roles.map((r) => (
              <option key={r.canonicalKey} value={r.canonicalKey}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("member.move.toLabel")}</label>
          <select
            value={targetNodeId}
            onChange={(e) => setTargetNodeId(e.target.value)}
            className={inputClass}
          >
            <option value="">
              {t("member.move.selectPlaceholder", {
                label: role?.label.toLowerCase() ?? t("member.move.selectFallback"),
              })}
            </option>
            {candidates.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </select>
          {candidates.length === 0 && (
            <p className="mt-1.5 text-xs text-gray-400">
              {t("member.move.noLocations", { label: role?.label.toLowerCase() ?? "" })}
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
