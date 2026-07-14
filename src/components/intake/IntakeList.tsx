"use client";

// Mobile-first student-intake list (ROADMAP SI-2 + SI-5). One tap-friendly card
// per class the caller may add shabab to: the class name, its head murabbi (so the
// admin sees who the student lands under before adding), an optional live count,
// and a full-width "Add shabab" button that opens the mini-batch AddMemberModal
// bound to that class. No org-tree navigation — this IS the add surface.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { UserPlusIcon, PersonIcon } from "@/components/ui/icons";
import type { RoleDef } from "@/lib/default-roles";
import type { IntakeClass } from "@/types/intake";

export function IntakeList({
  classes,
  studentRoles,
}: {
  classes: IntakeClass[];
  studentRoles: RoleDef[]; // the student role(s) for the class level (passed to the add flow)
}) {
  const { t } = useTranslation("intake");
  const router = useRouter();
  const [addFor, setAddFor] = useState<IntakeClass | null>(null);

  if (classes.length === 0) {
    return (
      <div className="mx-auto max-w-md">
        <EmptyState
          icon={<PersonIcon className="h-10 w-10" />}
          title={t("empty.title")}
          description={t("empty.description")}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">{t("heading.title")}</h1>
        <p className="text-sm text-slate-500">{t("heading.subtitle")}</p>
      </header>

      <ul className="space-y-3">
        {classes.map((c) => (
          <li
            key={c.nodeId}
            className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-slate-900">{c.name}</h2>
                {c.pathLabel && <p className="mt-0.5 truncate text-xs text-slate-400">{c.pathLabel}</p>}
                <p className="mt-2 flex items-center gap-2 text-sm">
                  <span
                    aria-hidden
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-[#2f55ea]/10 text-[11px] font-bold text-[#2f55ea]"
                  >
                    {c.murabbiName ? c.murabbiName.charAt(0) : "?"}
                  </span>
                  {c.murabbiName ? (
                    <span className="truncate text-slate-600">{t("class.ledBy", { name: c.murabbiName })}</span>
                  ) : (
                    <span className="truncate text-slate-400">{t("class.noMurabbi")}</span>
                  )}
                </p>
              </div>
              {typeof c.studentCount === "number" && c.studentCount > 0 && (
                <Badge color="blue">{t("class.count", { count: c.studentCount })}</Badge>
              )}
            </div>

            <button
              type="button"
              onClick={() => setAddFor(c)}
              className="mt-3.5 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2f55ea] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2545c8] active:scale-[0.98]"
            >
              <UserPlusIcon className="h-4 w-4" />
              {t("class.addShabab")}
            </button>
          </li>
        ))}
      </ul>

      {/* One modal, re-keyed per class so its mini-batch state resets when the
          target changes. Students keepOpen (name+Enter, name+Enter); we refresh on
          each add so the class count stays live. */}
      <AddMemberModal
        key={addFor?.nodeId ?? "none"}
        nodeId={addFor?.nodeId ?? null}
        roles={studentRoles}
        onClose={() => setAddFor(null)}
        onAdded={(_creds, opts) => {
          router.refresh();
          if (!opts?.keepOpen) setAddFor(null);
        }}
      />
    </div>
  );
}
