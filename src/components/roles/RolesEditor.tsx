"use client";

// Per-role permission editor. Each city role is a row; each permission a checkbox.
// Save is per-role (PUT replaces that role's grants). Edits take effect on the
// holders' next request (AuthzContext is per-request).

import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";

type Permission = { key: string; label: string; description: string | null };
type Role = { canonicalKey: string; label: string; permissionKeys: string[]; instantiated: boolean };

function setsEqual(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((k) => b.has(k));
}

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
  const { t } = useTranslation("roles");
  const [granted, setGranted] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.canonicalKey, new Set(r.permissionKeys)])),
  );
  // The last-saved state per role — a role is "dirty" when its current grants differ.
  const [saved, setSaved] = useState<Record<string, Set<string>>>(() =>
    Object.fromEntries(roles.map((r) => [r.canonicalKey, new Set(r.permissionKeys)])),
  );
  const [saving, setSaving] = useState<string | null>(null);

  const isDirty = (roleKey: string) => !setsEqual(granted[roleKey], saved[roleKey]);
  const anyDirty = roles.some((r) => isDirty(r.canonicalKey));

  // Warn before leaving with unsaved permission edits (per-row Save is easy to miss).
  useEffect(() => {
    if (!anyDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [anyDirty]);

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
        toast(json?.error?.message ?? t("editor.saveError"), "error");
        return;
      }
      // Mark this role clean by snapshotting what we just saved.
      setSaved((prev) => ({ ...prev, [role.canonicalKey]: new Set(granted[role.canonicalKey]) }));
      toast(t("editor.saved", { role: role.label }));
    } catch {
      toast(t("editor.networkError"), "error");
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="space-y-4">
      {roles.map((role) => (
        <div key={role.canonicalKey} className="rounded-2xl border border-slate-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-slate-900">{role.label}</h2>
              {!role.instantiated && <Badge color="amber">{t("editor.notInUse")}</Badge>}
              {isDirty(role.canonicalKey) && (
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-700 ring-1 ring-inset ring-amber-600/20">
                  {t("editor.unsaved", "Unsaved")}
                </span>
              )}
            </div>
            <Button
              size="sm"
              onClick={() => save(role)}
              loading={saving === role.canonicalKey}
              disabled={!isDirty(role.canonicalKey) || saving === role.canonicalKey}
            >
              {t("editor.save")}
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
