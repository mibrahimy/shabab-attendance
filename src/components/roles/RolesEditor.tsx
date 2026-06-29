"use client";

// Per-role permission editor. Each city role is a row; each permission a checkbox.
// Save is per-role (PUT replaces that role's grants). Edits take effect on the
// holders' next request (AuthzContext is per-request).

import { useState } from "react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type Permission = { key: string; label: string; description: string | null };
type Role = { canonicalKey: string; label: string; permissionKeys: string[]; instantiated: boolean };

export function RolesEditor({
  cityId,
  permissions,
  roles,
}: {
  cityId: string;
  permissions: Permission[];
  roles: Role[];
}) {
  const { toast } = useToast();
  const [granted, setGranted] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.canonicalKey, new Set(r.permissionKeys)])),
  );
  const [saving, setSaving] = useState<string | null>(null);

  function toggle(roleKey: string, permKey: string) {
    setGranted((prev) => {
      const next = new Set(prev[roleKey]);
      if (next.has(permKey)) next.delete(permKey);
      else next.add(permKey);
      return { ...prev, [roleKey]: next };
    });
  }

  async function save(role: Role) {
    setSaving(role.canonicalKey);
    try {
      const res = await fetch(`/api/cities/${cityId}/roles/${role.canonicalKey}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: [...granted[role.canonicalKey]] }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? "Could not save role", "error");
        return;
      }
      toast(`Saved ${role.label}`);
    } catch {
      toast("Network error", "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div key={role.canonicalKey} className="rounded-2xl border border-gray-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-gray-900">{role.label}</h2>
              {!role.instantiated && <Badge color="amber">not in use yet</Badge>}
            </div>
            <Button size="sm" onClick={() => save(role)} loading={saving === role.canonicalKey}>
              Save
            </Button>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {permissions.map((p) => {
              const on = granted[role.canonicalKey]?.has(p.key) ?? false;
              return (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggle(role.canonicalKey, p.key)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-[#2f55ea] focus:ring-[#2f55ea]/30"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-gray-800">{p.label}</span>
                    {p.description && (
                      <span className="block text-xs text-gray-400">{p.description}</span>
                    )}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
