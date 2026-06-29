"use client";

// Add a member at a node. Role choices are the catalog roles valid for the node's
// level (passed in). Student = profile-only (name + segment); staff = name + CNIC
// + phone (+ optional segment) and yields a one-time temp password.

import { useState } from "react";
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
  onAdded: (creds: Credentials | null) => void; // creds set only for staff
}) {
  const { toast } = useToast();
  const [roleKey, setRoleKey] = useState(roles[0]?.canonicalKey ?? "");
  const [name, setName] = useState("");
  const [cnic, setCnic] = useState("");
  const [phone, setPhone] = useState("");
  const [segment, setSegment] = useState<"" | "junior" | "senior">("");
  const [saving, setSaving] = useState(false);

  const role = roles.find((r) => r.canonicalKey === roleKey) ?? roles[0];
  const isStudent = role?.isStudent ?? false;
  const canSubmit = !!name.trim() && (isStudent || !!cnic.trim()) && !saving;

  async function submit() {
    if (!nodeId || !role) return;
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
        toast(json?.error?.message ?? "Could not add member", "error");
        return;
      }
      toast(`Added ${name}`);
      onAdded(
        json.data.tempPassword
          ? { name, cnic, tempPassword: json.data.tempPassword, context: role.label }
          : null,
      );
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={!!nodeId}
      onClose={onClose}
      title="Add member"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={submit} loading={saving} disabled={!canSubmit}>
            Add {role?.label ?? "member"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
          <select value={roleKey} onChange={(e) => setRoleKey(e.target.value)} className={inputClass}>
            {roles.map((r) => (
              <option key={r.canonicalKey} value={r.canonicalKey}>
                {r.label}
                {r.isStudent ? " (no login)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        {!isStudent && (
          <>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">
                CNIC (login username)
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
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone (optional)</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} />
            </div>
          </>
        )}

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Segment (optional)</label>
          <select
            value={segment}
            onChange={(e) => setSegment(e.target.value as "" | "junior" | "senior")}
            className={inputClass}
          >
            <option value="">—</option>
            <option value="junior">Junior</option>
            <option value="senior">Senior</option>
          </select>
        </div>
      </div>
    </Modal>
  );
}
