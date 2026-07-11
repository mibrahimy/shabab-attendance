"use client";

// Mobile-first drill-down navigator for one city's tree. Reads a flat subtree +
// the city's level template, builds the tree client-side, and supports
// add-child / rename / guarded-delete. Reads well on desktop (centered column).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslation } from "react-i18next";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CredentialsDialog, type Credentials } from "@/components/ui/CredentialsDialog";
import { useToast } from "@/components/ui/Toast";
import { nextLevel, type Level } from "@/lib/org-levels";
import { LEVEL_COLORS } from "@/lib/level-colors";
import type { RoleDef } from "@/lib/default-roles";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { MoveMemberModal } from "@/components/members/MoveMemberModal";
import { TreeOverview } from "./TreeOverview";
import { NodeNameModal } from "./NodeNameModal";
import { MoveNodeModal, type MoveTarget } from "./MoveNodeModal";

type NodeMember = {
  assignmentId: string;
  name: string;
  segment: "junior" | "senior" | null;
  roleLabel: string;
  hasLogin: boolean;
};

type TeamMember = { personId: string; name: string; roleLabel: string; nodeName: string; own: boolean };

export type BuilderNode = {
  id: string;
  name: string;
  parentId: string | null;
  level: { key: string; label: string; rank: number };
};

export function HierarchyBuilder({
  city,
  levels,
  nodes,
  roles,
}: {
  city: { id: string; name: string };
  levels: Level[];
  nodes: BuilderNode[];
  roles: RoleDef[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("hierarchy");

  // Overview = the whole-tree outline (default, so a built tree shows its shape);
  // Focus = the drill-down builder for one node.
  const [view, setView] = useState<"overview" | "focus">("overview");

  const { byId, childrenOf } = useMemo(() => {
    const byId = new Map<string, BuilderNode>();
    const childrenOf = new Map<string, BuilderNode[]>();
    for (const n of nodes) byId.set(n.id, n);
    for (const n of nodes) {
      if (n.parentId && byId.has(n.parentId)) {
        const arr = childrenOf.get(n.parentId) ?? [];
        arr.push(n);
        childrenOf.set(n.parentId, arr);
      }
    }
    return { byId, childrenOf };
  }, [nodes]);

  const [currentId, setCurrentId] = useState(city.id);
  const current = byId.get(currentId) ?? byId.get(city.id)!;

  const [modal, setModal] = useState<"add" | "rename" | "move" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Members of the current node — loaded lazily when the selected node changes.
  const [members, setMembers] = useState<NodeMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [creds, setCreds] = useState<Credentials | null>(null);
  const [moveTarget, setMoveTarget] = useState<{ assignmentId: string; name: string } | null>(null);
  const [removeTarget, setRemoveTarget] = useState<{ assignmentId: string; name: string } | null>(null);
  const [removing, setRemoving] = useState(false);

  const loadMembers = useCallback(async (nodeId: string) => {
    setMembersLoading(true);
    try {
      const res = await fetch(`/api/org-nodes/${nodeId}/members`);
      const json = await res.json().catch(() => ({}));
      setMembers(res.ok ? json.data.members : []);
    } catch {
      setMembers([]);
    } finally {
      setMembersLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMembers(currentId);
  }, [currentId, loadMembers]);

  // The node's derived team: its head + its direct children's heads (read-only).
  const [team, setTeam] = useState<TeamMember[]>([]);
  useEffect(() => {
    let alive = true;
    fetch(`/api/org-nodes/${currentId}/team`)
      .then((r) => r.json())
      .then((j) => alive && setTeam(j?.data?.members ?? []))
      .catch(() => alive && setTeam([]));
    return () => {
      alive = false;
    };
  }, [currentId]);

  async function removeMember() {
    if (!removeTarget) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/assignments/${removeTarget.assignmentId}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? t("toast.couldNotRemove"), "error");
        return;
      }
      toast(t("toast.removed", { name: removeTarget.name }));
      setRemoveTarget(null);
      void loadMembers(current.id);
    } catch {
      toast(t("toast.networkError"), "error");
    } finally {
      setRemoving(false);
    }
  }

  // Breadcrumb: walk up to the city root (parents above the city aren't loaded).
  const trail: BuilderNode[] = [];
  for (let n: BuilderNode | undefined = current; n; n = n.parentId ? byId.get(n.parentId) : undefined) {
    trail.unshift(n);
  }

  const children = childrenOf.get(current.id) ?? [];
  const childLevel = nextLevel(levels, current.level.rank);
  const isCityRoot = current.id === city.id;
  const rolesHere = roles.filter((r) => r.attachLevelKey === current.level.key);

  // Valid move destinations: any node one level above `current` (so the level
  // template still fits), excluding the current node, its existing parent, and
  // its own descendants (a node can't move under itself).
  const descendantIds = new Set<string>();
  {
    const stack = [current.id];
    while (stack.length) {
      for (const c of childrenOf.get(stack.pop()!) ?? []) {
        descendantIds.add(c.id);
        stack.push(c.id);
      }
    }
  }
  const moveTargets: MoveTarget[] = isCityRoot
    ? []
    : nodes
        .filter((n) => {
          if (n.id === current.id || n.id === current.parentId || descendantIds.has(n.id)) return false;
          return nextLevel(levels, n.level.rank)?.key === current.level.key;
        })
        .map((n) => {
          const parts: string[] = [];
          for (let p: BuilderNode | undefined = n; p; p = p.parentId ? byId.get(p.parentId) : undefined) {
            parts.unshift(p.name);
          }
          return { id: n.id, name: n.name, pathLabel: parts.join(" / ") };
        })
        .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel));

  async function call(url: string, method: string, body?: unknown): Promise<boolean> {
    setSaving(true);
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(json?.error?.message ?? t("toast.somethingWrong"), "error");
        return false;
      }
      return true;
    } catch {
      toast(t("toast.networkError"), "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addChild(name: string) {
    if (await call("/api/org-nodes", "POST", { parentId: current.id, name })) {
      toast(t("toast.added", { name }));
      setModal(null);
      router.refresh();
    }
  }

  async function rename(name: string) {
    if (await call(`/api/org-nodes/${current.id}`, "PATCH", { name })) {
      toast(t("toast.renamed"));
      setModal(null);
      router.refresh();
    }
  }

  async function move(newParentId: string) {
    if (await call(`/api/org-nodes/${current.id}`, "PATCH", { newParentId })) {
      toast(t("toast.moved", "Moved"));
      setModal(null);
      router.refresh();
    }
  }

  async function remove() {
    if (await call(`/api/org-nodes/${current.id}`, "DELETE")) {
      toast(t("toast.deleted"));
      setConfirmDelete(false);
      if (current.parentId) setCurrentId(current.parentId);
      router.refresh();
    } else {
      setConfirmDelete(false);
    }
  }

  return (
    <div>
      {/* View toggle: overview vs focus — mobile only; on lg both panes show side by side */}
      <div className="mb-4 inline-flex rounded-xl border border-slate-200/70 bg-white p-0.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)] lg:hidden">
        {(["overview", "focus"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            aria-pressed={view === v}
            className={`rounded-lg px-3 py-1.5 font-medium transition ${
              view === v ? "bg-[#2f55ea] text-white" : "text-gray-500 hover:text-gray-800"
            }`}
          >
            {t(`view.${v}`)}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-[340px_1fr] lg:items-start lg:gap-6">
      {/* Overview pane: left column on lg (sticky), full-width on mobile when selected */}
      <div
        className={`${view === "overview" ? "block" : "hidden"} lg:sticky lg:top-6 lg:block lg:max-h-[calc(100vh-3rem)] lg:overflow-auto`}
      >
        <TreeOverview
          nodes={nodes}
          byId={byId}
          childrenOf={childrenOf}
          rootId={city.id}
          onJump={(id) => {
            setCurrentId(id);
            setView("focus");
          }}
        />
      </div>

      {/* Focus pane: right column on lg, full-width on mobile when selected */}
      <div className={`${view === "focus" ? "block" : "hidden"} lg:block`}>
          {/* Breadcrumb */}
          <nav className="mb-4 flex flex-wrap items-center gap-1 text-sm text-gray-500">
        {trail.map((n, i) => (
          <span key={n.id} className="flex items-center gap-1">
            {i > 0 && <span className="text-gray-300">/</span>}
            <button
              onClick={() => setCurrentId(n.id)}
              className={`rounded px-1.5 py-0.5 hover:bg-white ${
                n.id === current.id ? "font-semibold text-gray-900" : "hover:text-gray-700"
              }`}
            >
              {n.name}
            </button>
          </span>
        ))}
      </nav>

      {/* Current node */}
      <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">{current.name}</h1>
              <Badge color={LEVEL_COLORS[current.level.key] ?? "gray"}>{current.level.label}</Badge>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={() => setModal("rename")}>
              {t("node.rename")}
            </Button>
            {!isCityRoot && moveTargets.length > 0 && (
              <Button size="sm" variant="secondary" onClick={() => setModal("move")}>
                {t("node.move", "Move")}
              </Button>
            )}
            {!isCityRoot && (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                {t("node.delete")}
              </Button>
            )}
          </div>
        </div>
        {childLevel && (
          <div className="mt-4">
            <Button size="sm" onClick={() => setModal("add")}>
              {t("node.addChild", { label: childLevel.label })}
            </Button>
          </div>
        )}
      </div>

      {/* Team — this node's head + its direct children's heads (derived) */}
      {team.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-slate-900">{t("team.title", "Team")}</h2>
            <span className="rounded-full bg-slate-100 px-2 py-0.5 font-num text-[11px] font-semibold text-slate-500">
              {team.length}
            </span>
          </div>
          <ul className="mt-3 divide-y divide-slate-100">
            {team.map((m) => (
              <li key={`${m.personId}-${m.nodeName}`} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#2f55ea]/10 text-[11px] font-bold text-[#2f55ea]">
                    {m.name.charAt(0)}
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-slate-900">{m.name}</span>
                    <span className="block truncate text-xs text-slate-400">
                      {m.roleLabel}
                      {!m.own && <span className="text-slate-300"> · {m.nodeName}</span>}
                    </span>
                  </span>
                </span>
                {m.own && (
                  <span className="shrink-0 rounded-full bg-[#2f55ea]/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[#2f55ea]">
                    {t("team.lead", "Lead")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* People at this node */}
      {rolesHere.length > 0 && (
        <div className="mb-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">{t("people.title")}</h2>
            <Button size="sm" variant="secondary" onClick={() => setAddMemberOpen(true)}>
              {t("people.addMember")}
            </Button>
          </div>
          {membersLoading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2 py-1">
                  <div className="h-5 w-16 animate-pulse rounded-full bg-gray-100" />
                  <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : members.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">{t("people.empty")}</p>
          ) : (
            <ul className="mt-3 divide-y divide-gray-100">
              {members.map((m) => (
                <li key={m.assignmentId} className="flex items-center justify-between gap-3 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <Badge color="slate">{m.roleLabel}</Badge>
                    <span className="truncate text-sm font-medium text-gray-900">{m.name}</span>
                    {m.segment && (
                      <span className="text-xs text-gray-400">{t(`people.segment.${m.segment}`)}</span>
                    )}
                    {m.hasLogin && (
                      <span className="text-xs text-gray-400" title={t("people.hasLoginTitle")}>
                        {t("people.login")}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-1">
                    <button
                      onClick={() => setMoveTarget({ assignmentId: m.assignmentId, name: m.name })}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100 hover:text-gray-700"
                    >
                      {t("people.move")}
                    </button>
                    <button
                      onClick={() => setRemoveTarget({ assignmentId: m.assignmentId, name: m.name })}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50"
                    >
                      {t("people.remove")}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Children */}
      {children.length === 0 ? (
        <EmptyState
          title={
            childLevel
              ? t("node.empty.childTitle", { label: `${childLevel.label.toLowerCase()}s` })
              : t("node.empty.leafTitle")
          }
          description={
            childLevel
              ? t("node.empty.childDescription", { label: childLevel.label.toLowerCase() })
              : t("node.empty.leafDescription")
          }
          action={
            childLevel ? (
              <Button size="sm" onClick={() => setModal("add")}>
                {t("node.addChild", { label: childLevel.label })}
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-2">
          {children.map((child) => {
            const grandkids = childrenOf.get(child.id)?.length ?? 0;
            return (
              <li key={child.id}>
                <button
                  onClick={() => setCurrentId(child.id)}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200/70 bg-white px-4 py-3 text-start shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-[#2f55ea]/30 hover:bg-slate-50"
                >
                  <span className="flex items-center gap-2">
                    <Badge color={LEVEL_COLORS[child.level.key] ?? "gray"}>{child.level.label}</Badge>
                    <span className="font-medium text-gray-900">{child.name}</span>
                  </span>
                  <span className="flex items-center gap-2 text-sm text-gray-400">
                    {grandkids > 0 && <span>{grandkids}</span>}
                    <span aria-hidden>›</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      </div>
      </div>

      {modal === "add" && childLevel && (
        <NodeNameModal
          title={t("modal.add.title", { label: childLevel.label })}
          label={t("modal.add.nameLabel", { label: childLevel.label })}
          submitLabel={t("modal.add.submit")}
          saving={saving}
          onSubmit={addChild}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "rename" && (
        <NodeNameModal
          title={t("modal.rename.title", { label: current.level.label })}
          label={t("modal.rename.nameLabel")}
          initialValue={current.name}
          submitLabel={t("modal.rename.submit")}
          saving={saving}
          onSubmit={rename}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "move" && (
        <MoveNodeModal
          nodeName={current.name}
          targets={moveTargets}
          saving={saving}
          onSubmit={move}
          onClose={() => setModal(null)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={t("delete.title", { name: current.name })}
        message={t("delete.message")}
        confirmLabel={t("delete.confirm")}
        variant="danger"
        loading={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />

      <AddMemberModal
        key={current.id}
        nodeId={addMemberOpen ? current.id : null}
        roles={rolesHere}
        onClose={() => setAddMemberOpen(false)}
        onAdded={(c) => {
          setAddMemberOpen(false);
          if (c) setCreds(c);
          void loadMembers(current.id);
        }}
      />
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />

      <MoveMemberModal
        key={moveTarget?.assignmentId ?? "none"}
        member={moveTarget}
        roles={roles}
        nodes={nodes}
        onClose={() => setMoveTarget(null)}
        onMoved={() => {
          setMoveTarget(null);
          void loadMembers(current.id);
        }}
      />
      <ConfirmDialog
        open={!!removeTarget}
        title={removeTarget ? t("remove.title", { name: removeTarget.name }) : t("remove.titleFallback")}
        message={t("remove.message")}
        confirmLabel={t("remove.confirm")}
        variant="danger"
        loading={removing}
        onConfirm={removeMember}
        onCancel={() => setRemoveTarget(null)}
      />
    </div>
  );
}
