"use client";

// Add a member at a node. Role choices are the catalog roles valid for the node's
// level (passed in). Student = profile-only (name + segment); staff = name + CNIC
// + phone (+ optional segment) and yields a one-time temp password.
//
// Students support MINI-BATCH intake: after a student is added the modal stays open,
// clears + refocuses the name, and keeps the role/segment — so onboarding a whole
// class is name+Enter, name+Enter. Staff still close on success (they yield a
// one-time credential the caller must surface).

import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { formatCnic } from "@/lib/cnic";
import type { RoleDef } from "@/lib/default-roles";
import type { Credentials } from "@/components/ui/CredentialsDialog";

const inputClass =
  "w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20";

export function AddMemberModal({
  nodeId,
  roles,
  onClose,
  onAdded,
}: {
  nodeId: string | null; // non-null = open
  roles: RoleDef[]; // roles valid at this node's level
  onClose: () => void;
  // creds set only for staff; keepOpen = student mini-batch (reload but don't close)
  onAdded: (creds: Credentials | null, opts?: { keepOpen?: boolean }) => void;
}) {
  const { toast } = useToast();
  const { t } = useTranslation("hierarchy");
  const [roleKey, setRoleKey] = useState(roles[0]?.canonicalKey ?? "");
  const [name, setName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [segment, setSegment] = useState<"" | "junior" | "senior">("");
  const [saving, setSaving] = useState(false);
  const [addedCount, setAddedCount] = useState(0);
  const nameRef = useRef<HTMLInputElement>(null);

  const role = roles.find((r) => r.canonicalKey === roleKey) ?? roles[0];
  const isStudent = role?.isStudent ?? false;
  const canSubmit = !!name.trim() && (isStudent || !!cnic.trim()) && !saving;

  async function submit() {
    if (!nodeId || !role || !canSubmit) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/org-nodes/${nodeId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleKey: role.canonicalKey,
          person: {
            name,
            cnic: isStudent ? undefined : cnic,
            phone: isStudent ? undefined : phone || undefined,
            segment: segment || undefined,
          },
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast(json?.error?.message ?? t("toast.couldNotAdd"), "error");
        return;
      }
      toast(t("toast.added", { name }));
      if (json.data.tempPassword) {
        // Staff → one-time credential; the caller closes + shows it.
        onAdded({ name, cnic, tempPassword: json.data.tempPassword, context: role.label });
      } else {
        // Student → mini-batch: reload but stay open, clear + refocus for the next one.
        setAddedCount((n) => n + 1);
        setName("");
        onAdded(null, { keepOpen: true });
        requestAnimationFrame(() => nameRef.current?.focus());
      }
    } catch {
      toast(t("toast.networkError"), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!nodeId}
      onClose={onClose}
      title={t("member.add.title")}
      footer={
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-[#2f55ea]">
            {addedCount > 0 ? t("member.add.addedCount", { count: addedCount, defaultValue: "Added {{count}}" }) : ""}
          </span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose}>
              {addedCount > 0 ? t("member.add.done", "Done") : t("modal.cancel")}
            </Button>
            <Button onClick={submit} loading={saving} disabled={!canSubmit}>
              {addedCount > 0 && isStudent
                ? t("member.add.another", "Add another")
                : t("member.add.submit", { label: role?.label ?? t("member.add.submitFallback") })}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("member.fields.role")}</label>
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={inputClass}>
            {roles.map((r) => (
              <option key={r.canonicalKey} value={r.canonicalKey}>
                {r.label}
                {r.isStudent ? t("member.fields.noLogin") : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("member.fields.fullName")}</label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void submit();
              }
            }}
            autoFocus
            className={inputClass}
          />
        </div>

        {!isStudent && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                {t("member.fields.cnic")}
              </label>
              <input
                value={cnic}
                onChange={(e) => setCnic(formatCnic(e.target.value))}
                inputMode="numeric"
                maxLength={15}
                placeholder="00000-0000000-0"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("member.fields.phone")}</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">{t("member.fields.segment")}</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as "" | "junior" | "senior")}
            className={inputClass}
          >
            <option value="">{t("member.fields.segmentNone")}</option>
            <option value="junior">{t("member.fields.segmentJunior")}</option>
            <option value="senior">{t("member.fields.segmentSenior")}</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
