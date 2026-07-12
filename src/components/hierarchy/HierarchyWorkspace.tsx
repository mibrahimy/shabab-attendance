"use client";

// Unified hierarchy editor for one city: an interactive Tree view and an
// Org-chart view of the same subtree, with a selected-node detail pane (derived
// team + people). Type-to-create nodes, drag to re-parent nodes / reassign
// people (onto the real move engine), plus focus/re-root, search, and — in the
// chart — pan, zoom, and a minimap for large trees. Replaces the old drill-down
// HierarchyBuilder. All mutations hit the existing guarded+audited endpoints and
// then router.refresh(); the modal-based Move actions stay as the touch/a11y path.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { BadgeColor } from "@/types";
import type { RoleDef } from "@/lib/default-roles";
import { AddMemberModal } from "@/components/members/AddMemberModal";
import { MoveMemberModal } from "@/components/members/MoveMemberModal";
import { NodeNameModal } from "./NodeNameModal";
import { MoveNodeModal, type MoveTarget } from "./MoveNodeModal";

export type WorkspaceNode = {
  id: string;
  name: string;
  parentId: string | null;
  level: { key: string; label: string; rank: number };
};

type NodeMember = {
  assignmentId: string;
  personId: string;
  name: string;
  segment: "junior" | "senior" | null;
  roleKey: string;
  roleLabel: string;
  hasLogin: boolean;
};

type TeamMember = { personId: string; name: string; roleLabel: string; nodeId: string; nodeName: string; own: boolean };

type DragState =
  | { kind: "node"; id: string }
  | { kind: "person"; assignmentId: string; fromNodeId: string; roleKey: string; attachLevelKey: string | null; name: string };

const BADGE_COLORS: BadgeColor[] = ["blue", "green", "amber", "purple", "indigo", "orange", "pink", "red", "slate"];

export function HierarchyWorkspace({
  city,
  levels,
  nodes,
  roles,
}: {
  city: { id: string; name: string };
  levels: Level[];
  nodes: WorkspaceNode[];
  roles: RoleDef[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const { t } = useTranslation("hierarchy");

  const { byId, childrenOf } = useMemo(() => {
    const byId = new Map<string, WorkspaceNode>();
    const childrenOf = new Map<string, WorkspaceNode[]>();
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

  // Per-level tint: honour the data-driven Level.color; custom levels get a
  // stable derived colour instead of falling through to grey.
  const levelColorByKey = useMemo(() => {
    const m = new Map<string, BadgeColor>();
    for (const lvl of levels) {
      const c = lvl.color;
      if (c && (BADGE_COLORS as string[]).includes(c)) m.set(lvl.key, c as BadgeColor);
      else if (LEVEL_COLORS[lvl.key]) m.set(lvl.key, LEVEL_COLORS[lvl.key]);
      else {
        let h = 0;
        for (const ch of lvl.key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        m.set(lvl.key, BADGE_COLORS[h % BADGE_COLORS.length]);
      }
    }
    return m;
  }, [levels]);
  const levelColor = useCallback((key: string): BadgeColor => levelColorByKey.get(key) ?? "gray", [levelColorByKey]);

  const [view, setView] = useState<"tree" | "chart">("tree");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [focusId, setFocusId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>(city.id);
  const [query, setQuery] = useState("");
  const [zoom, setZoom] = useState(1);

  // Drag (HTML5 DnD). validIds/overId drive the drop highlighting.
  const dragRef = useRef<DragState | null>(null);
  const [validIds, setValidIds] = useState<Set<string>>(new Set());
  const [overId, setOverId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  // Lazy members cache, keyed by node id.
  const [membersByNode, setMembersByNode] = useState<Record<string, NodeMember[]>>({});
  const [team, setTeam] = useState<TeamMember[]>([]);

  const [saving, setSaving] = useState(false);
  const [nodeModal, setNodeModal] = useState<{ mode: "add" | "rename"; nodeId: string } | null>(null);
  const [moveNodeFor, setMoveNodeFor] = useState<WorkspaceNode | null>(null);
  const [deleteFor, setDeleteFor] = useState<WorkspaceNode | null>(null);
  const [confirmMove, setConfirmMove] = useState<{ node: WorkspaceNode; target: WorkspaceNode; run: () => void } | null>(null);
  const [addMemberFor, setAddMemberFor] = useState<string | null>(null);
  const [creds, setCreds] = useState<Credentials | null>(null);
  // nodeId = the node the member is currently under, so a mutation refreshes the
  // RIGHT node's cached members (not just whatever node is selected).
  const [moveMemberFor, setMoveMemberFor] = useState<{ assignmentId: string; name: string; nodeId: string } | null>(null);
  const [removeMemberFor, setRemoveMemberFor] = useState<{ assignmentId: string; name: string; nodeId: string } | null>(null);

  const selected = byId.get(selectedId) ?? byId.get(city.id)!;
  const rootId = focusId && byId.has(focusId) ? focusId : city.id;
  const root = byId.get(rootId) ?? byId.get(city.id)!;

  const childLevelOf = useCallback(
    (node: WorkspaceNode) => nextLevel(levels, node.level.rank),
    [levels],
  );
  const rolesAt = useCallback(
    (node: WorkspaceNode) => roles.filter((r) => r.attachLevelKey === node.level.key),
    [roles],
  );

  const descendantsOf = useCallback(
    (id: string) => {
      const out = new Set<string>();
      const stack = [id];
      while (stack.length) {
        for (const c of childrenOf.get(stack.pop()!) ?? []) {
          out.add(c.id);
          stack.push(c.id);
        }
      }
      return out;
    },
    [childrenOf],
  );

  const trail = useMemo(() => {
    const arr: WorkspaceNode[] = [];
    for (let n: WorkspaceNode | undefined = byId.get(rootId); n; n = n.parentId ? byId.get(n.parentId) : undefined) {
      arr.unshift(n);
    }
    return arr;
  }, [byId, rootId]);

  // ---- data loading ---------------------------------------------------------
  const loadMembers = useCallback(async (nodeId: string) => {
    try {
      const res = await fetch(`/api/org-nodes/${nodeId}/members`);
      const json = await res.json().catch(() => ({}));
      if (res.ok) setMembersByNode((m) => ({ ...m, [nodeId]: json.data.members }));
    } catch {
      /* keep whatever we had */
    }
  }, []);

  // Load members for the selected node (detail pane) and whenever a role-bearing
  // node is expanded in the tree.
  useEffect(() => {
    if (!(selectedId in membersByNode)) void loadMembers(selectedId);
  }, [selectedId, membersByNode, loadMembers]);

  useEffect(() => {
    let alive = true;
    setTeam([]);
    fetch(`/api/org-nodes/${selectedId}/team`)
      .then((r) => r.json())
      .then((j) => alive && setTeam(j?.data?.members ?? []))
      .catch(() => alive && setTeam([]));
    return () => {
      alive = false;
    };
  }, [selectedId]);

  // ---- search ---------------------------------------------------------------
  const { matchNodeIds, matchPersonIds } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const nodeIds = new Set<string>();
    const personIds = new Set<string>();
    if (q) {
      for (const n of nodes) if (n.name.toLowerCase().includes(q)) nodeIds.add(n.id);
      for (const list of Object.values(membersByNode)) {
        for (const p of list) if (p.name.toLowerCase().includes(q)) personIds.add(p.assignmentId);
      }
    }
    return { matchNodeIds: nodeIds, matchPersonIds: personIds };
  }, [query, nodes, membersByNode]);

  // Auto-expand ancestors of matches so hits are visible.
  useEffect(() => {
    if (matchNodeIds.size === 0) return;
    setCollapsed((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      for (const id of matchNodeIds) {
        let p = byId.get(id)?.parentId ?? null;
        while (p) {
          next.delete(p);
          p = byId.get(p)?.parentId ?? null;
        }
      }
      return next;
    });
  }, [matchNodeIds, byId]);

  const structureRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!query.trim()) return;
    const el = structureRef.current?.querySelector(".hw-match");
    el?.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  }, [query, view, matchNodeIds]);

  // ---- mutations ------------------------------------------------------------
  const call = useCallback(
    async (url: string, method: string, body?: unknown): Promise<boolean> => {
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
    },
    [t, toast],
  );

  async function submitNodeModal(name: string) {
    if (!nodeModal) return;
    if (nodeModal.mode === "add") {
      if (await call("/api/org-nodes", "POST", { parentId: nodeModal.nodeId, name })) {
        toast(t("toast.added", { name }));
        setNodeModal(null);
        setCollapsed((c) => {
          const n = new Set(c);
          n.delete(nodeModal.nodeId);
          return n;
        });
        router.refresh();
      }
    } else {
      if (await call(`/api/org-nodes/${nodeModal.nodeId}`, "PATCH", { name })) {
        toast(t("toast.renamed"));
        setNodeModal(null);
        router.refresh();
      }
    }
  }

  async function addChildInline(parentId: string, name: string) {
    if (await call("/api/org-nodes", "POST", { parentId, name })) {
      toast(t("toast.added", { name }));
      router.refresh();
    }
  }

  async function submitMoveNode(newParentId: string) {
    if (!moveNodeFor) return;
    if (await call(`/api/org-nodes/${moveNodeFor.id}`, "PATCH", { newParentId })) {
      toast(t("toast.moved", { name: moveNodeFor.name }));
      setMoveNodeFor(null);
      router.refresh();
    }
  }

  async function doDeleteNode() {
    if (!deleteFor) return;
    if (await call(`/api/org-nodes/${deleteFor.id}`, "DELETE")) {
      toast(t("toast.deleted"));
      if (deleteFor.parentId) setSelectedId(deleteFor.parentId);
      setDeleteFor(null);
      router.refresh();
    } else {
      setDeleteFor(null);
    }
  }

  async function doRemoveMember() {
    if (!removeMemberFor) return;
    if (await call(`/api/assignments/${removeMemberFor.assignmentId}`, "DELETE")) {
      toast(t("toast.removed", { name: removeMemberFor.name }));
      const nid = removeMemberFor.nodeId;
      setRemoveMemberFor(null);
      void loadMembers(nid);
      router.refresh();
    } else {
      setRemoveMemberFor(null);
    }
  }

  // Move a node onto a new parent (drag drop). Confirms when it carries a subtree.
  async function performNodeMove(nodeId: string, newParentId: string) {
    if (await call(`/api/org-nodes/${nodeId}`, "PATCH", { newParentId })) {
      toast(t("toast.moved", { name: byId.get(nodeId)?.name ?? "" }));
      router.refresh();
    }
  }

  async function performPersonMove(d: Extract<DragState, { kind: "person" }>, targetNodeId: string) {
    if (
      await call(`/api/assignments/${d.assignmentId}`, "PATCH", {
        targetNodeId,
        roleKey: d.roleKey,
      })
    ) {
      toast(t("toast.moved", { name: d.name }));
      void loadMembers(d.fromNodeId);
      void loadMembers(targetNodeId);
      router.refresh();
    }
  }

  // ---- drag/drop ------------------------------------------------------------
  const nodeMoveTargets = useCallback(
    (nodeId: string): Set<string> => {
      const node = byId.get(nodeId);
      if (!node) return new Set();
      const desc = descendantsOf(nodeId);
      const set = new Set<string>();
      for (const n of nodes) {
        if (n.id === nodeId || n.id === node.parentId || desc.has(n.id)) continue;
        if (nextLevel(levels, n.level.rank)?.key === node.level.key) set.add(n.id);
      }
      return set;
    },
    [byId, descendantsOf, levels, nodes],
  );

  function startNodeDrag(nodeId: string) {
    dragRef.current = { kind: "node", id: nodeId };
    setValidIds(nodeMoveTargets(nodeId));
    setDragging(true);
  }
  function startPersonDrag(m: NodeMember, fromNodeId: string) {
    const role = roles.find((r) => r.canonicalKey === m.roleKey);
    const attach = role?.attachLevelKey ?? null;
    dragRef.current = { kind: "person", assignmentId: m.assignmentId, fromNodeId, roleKey: m.roleKey, attachLevelKey: attach, name: m.name };
    const set = new Set<string>();
    for (const n of nodes) if (n.id !== fromNodeId && n.level.key === attach) set.add(n.id);
    setValidIds(set);
    setDragging(true);
  }
  function endDrag() {
    dragRef.current = null;
    setValidIds(new Set());
    setOverId(null);
    setDragging(false);
  }
  function onDropOnNode(targetId: string) {
    const d = dragRef.current;
    if (!d || !validIds.has(targetId)) {
      endDrag();
      return;
    }
    const target = byId.get(targetId);
    if (!target) {
      endDrag();
      return;
    }
    if (d.kind === "node") {
      const node = byId.get(d.id)!;
      const hasSubtree = (childrenOf.get(d.id)?.length ?? 0) > 0;
      const run = () => void performNodeMove(d.id, targetId);
      if (hasSubtree) setConfirmMove({ node, target, run });
      else run();
    } else {
      void performPersonMove(d, targetId);
    }
    endDrag();
  }

  // ---- render helpers -------------------------------------------------------
  const nodeClasses = useCallback(
    (id: string) => {
      const cls: string[] = [];
      if (dragging) {
        if (validIds.has(id)) cls.push("hw-valid");
        else cls.push("hw-invalid");
        if (overId === id) cls.push("hw-over");
      }
      if (matchNodeIds.has(id)) cls.push("hw-match");
      return cls.join(" ");
    },
    [dragging, validIds, overId, matchNodeIds],
  );

  const dropProps = (id: string) => ({
    onDragOver: (e: React.DragEvent) => {
      if (!dragRef.current || !validIds.has(id)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (overId !== id) setOverId(id);
    },
    onDrop: (e: React.DragEvent) => {
      e.preventDefault();
      onDropOnNode(id);
    },
  });

  function renderPeople(node: WorkspaceNode) {
    const list = membersByNode[node.id];
    if (!list || list.length === 0) return null;
    return (
      <div className="hw-people">
        {list.map((m) => (
          <div
            key={m.assignmentId}
            className={`hw-prow ${matchPersonIds.has(m.assignmentId) ? "hw-match" : ""}`}
            draggable
            onDragStart={() => startPersonDrag(m, node.id)}
            onDragEnd={endDrag}
          >
            <span className="hw-grip" aria-hidden>⠿</span>
            <span className="hw-avatar">{m.name.charAt(0)}</span>
            <span className="hw-pname">{m.name}</span>
            <Badge color="slate">{m.roleLabel}</Badge>
            <span className="hw-sp" />
            <button
              type="button"
              className="hw-ico"
              title={t("people.move")}
              onClick={() => setMoveMemberFor({ assignmentId: m.assignmentId, name: m.name, nodeId: node.id })}
            >
              ⇄
            </button>
            <button
              type="button"
              className="hw-ico hw-danger"
              title={t("people.remove")}
              onClick={() => setRemoveMemberFor({ assignmentId: m.assignmentId, name: m.name, nodeId: node.id })}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    );
  }

  function renderTreeNode(node: WorkspaceNode) {
    const kids = childrenOf.get(node.id) ?? [];
    const childLevel = childLevelOf(node);
    const hasPeople = rolesAt(node).length > 0;
    const isOpen = !collapsed.has(node.id);
    const kidCount = kids.length;
    const expandable = kidCount > 0 || hasPeople || !!childLevel;
    return (
      <div className={`hw-node ${nodeClasses(node.id)}`} key={node.id}>
        <div
          className={`hw-row ${selectedId === node.id ? "hw-selected" : ""}`}
          onClick={() => setSelectedId(node.id)}
          {...dropProps(node.id)}
        >
          {expandable ? (
            <button
              type="button"
              className="hw-tw"
              onClick={(e) => {
                e.stopPropagation();
                toggle(node.id);
              }}
              aria-label={isOpen ? t("a11y.collapse") : t("a11y.expand")}
            >
              {isOpen ? "▾" : "▸"}
            </button>
          ) : (
            <span className="hw-tw hw-ph" />
          )}
          {node.parentId ? (
            <span
              className="hw-grip"
              draggable
              onDragStart={(e) => {
                e.stopPropagation();
                startNodeDrag(node.id);
              }}
              onDragEnd={endDrag}
              title={t("drag.hint")}
            >
              ⠿
            </span>
          ) : (
            <span className="hw-grip hw-ph">⌂</span>
          )}
          <Badge color={levelColor(node.level.key)}>{node.level.label}</Badge>
          <span className="hw-name">{node.name}</span>
          {kidCount > 0 && <span className="hw-count">{kidCount}</span>}
          <span className="hw-sp" />
          {kidCount > 0 && node.parentId && (
            <button
              type="button"
              className="hw-ico"
              title={t("focus.action")}
              onClick={(e) => {
                e.stopPropagation();
                setFocusId(node.id);
              }}
            >
              ⌖
            </button>
          )}
        </div>
        {isOpen && (
          <div className="hw-children">
            {kids.map((k) => renderTreeNode(k))}
            {hasPeople && renderPeople(node)}
            {childLevel && (
              <InlineAdd
                placeholder={t("tree.addChild", { label: childLevel.label.toLowerCase() })}
                onAdd={(name) => addChildInline(node.id, name)}
              />
            )}
            {hasPeople && (
              <button type="button" className="hw-addperson" onClick={() => { setSelectedId(node.id); setAddMemberFor(node.id); }}>
                ＋ {t("people.addMember")}
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  function renderChartNode(node: WorkspaceNode): React.ReactNode {
    const kids = childrenOf.get(node.id) ?? [];
    const childLevel = childLevelOf(node);
    const isOpen = !collapsed.has(node.id);
    return (
      <li key={node.id}>
        <div
          className={`hw-box ${selectedId === node.id ? "hw-selected" : ""} ${nodeClasses(node.id)}`}
          draggable={!!node.parentId}
          onDragStart={(e) => {
            if (!node.parentId) return;
            e.stopPropagation();
            startNodeDrag(node.id);
          }}
          onDragEnd={endDrag}
          onClick={() => setSelectedId(node.id)}
          {...dropProps(node.id)}
        >
          <div className="hw-box-acts">
            {kids.length > 0 && node.parentId && (
              <button type="button" title={t("focus.action")} onClick={(e) => { e.stopPropagation(); setFocusId(node.id); }}>⌖</button>
            )}
            {childLevel && (
              <button type="button" title={t("tree.add", { label: childLevel.label })} onClick={(e) => { e.stopPropagation(); setNodeModal({ mode: "add", nodeId: node.id }); }}>＋</button>
            )}
            {node.parentId && (
              <button type="button" className="hw-danger" title={t("node.delete")} onClick={(e) => { e.stopPropagation(); setDeleteFor(node); }}>✕</button>
            )}
          </div>
          <div className="hw-box-top">
            <Badge color={levelColor(node.level.key)}>{node.level.label}</Badge>
          </div>
          <div className="hw-box-name" onDoubleClick={(e) => { e.stopPropagation(); setNodeModal({ mode: "rename", nodeId: node.id }); }}>
            {node.name}
          </div>
          {(kids.length > 0 || (membersByNode[node.id]?.length ?? 0) > 0) && (
            <div className="hw-box-meta">
              {kids.length > 0 && childLevel && <span>{kids.length} {childLevel.label.toLowerCase()}</span>}
              {(membersByNode[node.id]?.length ?? 0) > 0 && <span>{membersByNode[node.id]!.length} {t("people.short")}</span>}
            </div>
          )}
          {kids.length > 0 && (
            <button
              type="button"
              className="hw-collapse-tab"
              onClick={(e) => { e.stopPropagation(); toggle(node.id); }}
            >
              {isOpen ? "▾" : `▸ ${kids.length}`}
            </button>
          )}
        </div>
        {kids.length > 0 && isOpen && <ul>{kids.map((k) => renderChartNode(k))}</ul>}
      </li>
    );
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        // fetch people for a role-bearing node the first time it opens
        const node = byId.get(id);
        if (node && rolesAt(node).length > 0 && !(id in membersByNode)) void loadMembers(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  // ---- chart pan / zoom / minimap ------------------------------------------
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const minimapRef = useRef<HTMLDivElement | null>(null);
  const mmGeo = useRef<{ k: number; offX: number; offY: number }>({ k: 1, offX: 0, offY: 0 });

  const clampZoom = (z: number) => Math.max(0.4, Math.min(1.6, Math.round(z * 10) / 10));

  const updateMinimapView = useCallback(() => {
    const canvas = canvasRef.current;
    const mv = minimapRef.current?.querySelector<HTMLDivElement>(".hw-mm-view");
    if (!canvas || !mv) return;
    const { k, offX, offY } = mmGeo.current;
    mv.style.transform = `translate(${offX + canvas.scrollLeft * k}px, ${offY + canvas.scrollTop * k}px)`;
    mv.style.width = `${canvas.clientWidth * k}px`;
    mv.style.height = `${canvas.clientHeight * k}px`;
  }, []);

  const buildMinimap = useCallback(() => {
    const mm = minimapRef.current;
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!mm || !stage || !canvas) return;
    const cw = stage.offsetWidth;
    const ch = stage.offsetHeight;
    const rw = cw * zoom;
    const rh = ch * zoom;
    const boxW = 184;
    const boxH = 130;
    const k = Math.min((boxW - 8) / rw, (boxH - 16) / rh, 0.5);
    const offX = Math.max(4, (boxW - rw * k) / 2);
    const offY = Math.max(16, (boxH - rh * k) / 2);
    mmGeo.current = { k, offX, offY };
    mm.innerHTML =
      '<div class="hw-mm-label">overview</div>' +
      `<div class="hw-mm-inner" style="width:${cw}px;height:${ch}px;transform:translate(${offX}px,${offY}px) scale(${k * zoom})">${stage.innerHTML}</div>` +
      '<div class="hw-mm-view"></div>';
    updateMinimapView();
  }, [zoom, updateMinimapView]);

  // Rebuild the minimap after chart renders / zoom changes.
  useEffect(() => {
    if (view !== "chart") return;
    const id = window.setTimeout(buildMinimap, 0);
    return () => window.clearTimeout(id);
  }, [view, zoom, buildMinimap, nodes, collapsed, focusId, membersByNode]);

  // Pan + ctrl/cmd-wheel zoom on the canvas.
  useEffect(() => {
    if (view !== "chart") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    let panning = false;
    let px = 0;
    let py = 0;
    const isInteractive = (el: EventTarget | null) =>
      el instanceof Element && el.closest("[draggable=true],button,input,.hw-collapse-tab");
    const down = (e: PointerEvent) => {
      if (isInteractive(e.target)) return;
      panning = true;
      px = e.clientX;
      py = e.clientY;
      canvas.classList.add("hw-panning");
      canvas.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!panning) return;
      canvas.scrollLeft -= e.clientX - px;
      canvas.scrollTop -= e.clientY - py;
      px = e.clientX;
      py = e.clientY;
      updateMinimapView();
    };
    const up = () => {
      panning = false;
      canvas.classList.remove("hw-panning");
    };
    const wheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        setZoom((z) => clampZoom(z + (e.deltaY < 0 ? 0.1 : -0.1)));
      }
    };
    const scroll = () => updateMinimapView();
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", move);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", wheel, { passive: false });
    canvas.addEventListener("scroll", scroll);
    return () => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", move);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointercancel", up);
      canvas.removeEventListener("wheel", wheel);
      canvas.removeEventListener("scroll", scroll);
    };
  }, [view, updateMinimapView]);

  function jumpMinimap(e: React.PointerEvent) {
    const canvas = canvasRef.current;
    const mm = minimapRef.current;
    if (!canvas || !mm) return;
    const r = mm.getBoundingClientRect();
    const { k, offX, offY } = mmGeo.current;
    canvas.scrollLeft = (e.clientX - r.left - offX) / k - canvas.clientWidth / 2;
    canvas.scrollTop = (e.clientY - r.top - offY) / k - canvas.clientHeight / 2;
    updateMinimapView();
  }

  // ---- node detail actions --------------------------------------------------
  const selectedChildLevel = childLevelOf(selected);
  const rolesHere = rolesAt(selected);
  const isCityRoot = selected.id === city.id;
  const selectedMembers = membersByNode[selected.id];

  const moveTargetsForSelected: MoveTarget[] = useMemo(() => {
    if (!selected.parentId) return [];
    const valid = nodeMoveTargets(selected.id);
    return nodes
      .filter((n) => valid.has(n.id))
      .map((n) => {
        const parts: string[] = [];
        for (let p: WorkspaceNode | undefined = n; p; p = p.parentId ? byId.get(p.parentId) : undefined) parts.unshift(p.name);
        return { id: n.id, name: n.name, pathLabel: parts.join(" / ") };
      })
      .sort((a, b) => a.pathLabel.localeCompare(b.pathLabel));
  }, [selected, nodes, nodeMoveTargets, byId]);

  const chartLevelSpan = useMemo(() => Math.round(zoom * 100), [zoom]);

  return (
    <div className="hw" ref={structureRef}>
      <style>{CHART_CSS}</style>

      {/* Toolbar */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("search.placeholder")}
          className="w-full max-w-[220px] rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/15"
        />
        <div className="inline-flex rounded-xl border border-slate-200/70 bg-white p-0.5 text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          {(["tree", "chart"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              aria-pressed={view === v}
              className={`rounded-lg px-3 py-1.5 font-medium transition ${
                view === v ? "bg-[#2f55ea] text-white" : "text-slate-500 hover:text-slate-800"
              }`}
            >
              {t(`view.${v}`)}
            </button>
          ))}
        </div>
        {view === "chart" && (
          <div className="inline-flex items-center rounded-xl border border-slate-200/70 bg-white text-sm shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <button className="px-2.5 py-1.5 text-slate-600 hover:text-[#2f55ea]" onClick={() => setZoom((z) => clampZoom(z - 0.1))} aria-label={t("zoom.out")}>−</button>
            <span className="min-w-[3rem] text-center font-num text-xs text-slate-500">{chartLevelSpan}%</span>
            <button className="px-2.5 py-1.5 text-slate-600 hover:text-[#2f55ea]" onClick={() => setZoom((z) => clampZoom(z + 0.1))} aria-label={t("zoom.in")}>+</button>
            <button className="border-slate-200 px-2.5 py-1.5 text-slate-600 hover:text-[#2f55ea]" onClick={() => setZoom(1)}>{t("zoom.fit")}</button>
          </div>
        )}
      </div>

      {/* Focus breadcrumb */}
      {focusId && (
        <nav className="mb-3 flex flex-wrap items-center gap-1 text-sm text-slate-500">
          <span aria-hidden>📍</span>
          {trail.map((n, i) => {
            const last = i === trail.length - 1;
            return (
              <span key={n.id} className="flex items-center gap-1">
                {i > 0 && <span className="text-slate-300">›</span>}
                <button
                  onClick={() => setFocusId(n.id === city.id ? null : n.id)}
                  disabled={last}
                  className={`rounded px-1.5 py-0.5 ${last ? "font-semibold text-slate-900" : "text-[#2f55ea] hover:bg-[#2f55ea]/[0.06]"}`}
                >
                  {n.name}
                </button>
              </span>
            );
          })}
          <button onClick={() => setFocusId(null)} className="ms-1 rounded px-1.5 py-0.5 text-xs text-slate-400 hover:text-slate-700">
            {t("focus.clear")}
          </button>
        </nav>
      )}

      <div className="lg:grid lg:grid-cols-[1fr_360px] lg:items-start lg:gap-5">
        {/* Structure pane */}
        <div className="min-w-0">
          {view === "tree" ? (
            <div className="hw-tree rounded-2xl border border-slate-200/70 bg-white p-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              {renderTreeNode(root)}
            </div>
          ) : (
            <div className="hw-canvas rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]" ref={canvasRef}>
              <div className="hw-stage" ref={stageRef} style={{ transform: `scale(${zoom})` }}>
                <div className="hw-chart">
                  <ul>{renderChartNode(root)}</ul>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Selected-node detail pane */}
        <div className="mt-4 lg:mt-0 lg:sticky lg:top-4">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Badge color={levelColor(selected.level.key)}>{selected.level.label}</Badge>
                <h2 className="mt-1 truncate text-lg font-semibold tracking-tight text-slate-900">{selected.name}</h2>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedChildLevel && (
                <Button size="sm" onClick={() => setNodeModal({ mode: "add", nodeId: selected.id })}>
                  {t("node.addChild", { label: selectedChildLevel.label })}
                </Button>
              )}
              <Button size="sm" variant="secondary" onClick={() => setNodeModal({ mode: "rename", nodeId: selected.id })}>
                {t("node.rename")}
              </Button>
              {!isCityRoot && moveTargetsForSelected.length > 0 && (
                <Button size="sm" variant="secondary" onClick={() => setMoveNodeFor(selected)}>
                  {t("node.move")}
                </Button>
              )}
              {!isCityRoot && (
                <Button size="sm" variant="danger" onClick={() => setDeleteFor(selected)}>
                  {t("node.delete")}
                </Button>
              )}
            </div>
          </div>

          {/* Team */}
          {team.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-900">{t("team.title")}</h3>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-num text-[11px] font-semibold text-slate-500">{team.length}</span>
              </div>
              <ul className="mt-3 divide-y divide-slate-100">
                {team.map((m) => (
                  <li key={`${m.personId}-${m.nodeName}`} className="flex items-center justify-between gap-3 py-2">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[#2f55ea]/10 text-[11px] font-bold text-[#2f55ea]">{m.name.charAt(0)}</span>
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
                        {t("team.lead")}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* People */}
          {rolesHere.length > 0 && (
            <div className="mt-4 rounded-2xl border border-slate-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-slate-900">{t("people.title")}</h3>
                <Button size="sm" variant="secondary" onClick={() => setAddMemberFor(selected.id)}>{t("people.addMember")}</Button>
              </div>
              {selectedMembers === undefined ? (
                <div className="mt-3 space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-2 py-1">
                      <div className="h-5 w-16 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
                    </div>
                  ))}
                </div>
              ) : selectedMembers.length === 0 ? (
                <p className="mt-3 text-sm text-slate-400">{t("people.empty")}</p>
              ) : (
                <ul className="mt-3 divide-y divide-slate-100">
                  {selectedMembers.map((m) => (
                    <li
                      key={m.assignmentId}
                      className="flex items-center justify-between gap-3 py-2"
                      draggable
                      onDragStart={() => startPersonDrag(m, selected.id)}
                      onDragEnd={endDrag}
                    >
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="hw-grip cursor-grab text-slate-300" aria-hidden>⠿</span>
                        <Badge color="slate">{m.roleLabel}</Badge>
                        <span className="truncate text-sm font-medium text-slate-900">{m.name}</span>
                        {m.segment && <span className="text-xs text-slate-400">{t(`people.segment.${m.segment}`)}</span>}
                      </span>
                      <span className="flex shrink-0 items-center gap-1">
                        <button onClick={() => setMoveMemberFor({ assignmentId: m.assignmentId, name: m.name, nodeId: selected.id })} className="rounded-lg px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700">
                          {t("people.move")}
                        </button>
                        <button onClick={() => setRemoveMemberFor({ assignmentId: m.assignmentId, name: m.name, nodeId: selected.id })} className="rounded-lg px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
                          {t("people.remove")}
                        </button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {!selectedChildLevel && rolesHere.length === 0 && team.length === 0 && (
            <div className="mt-4">
              <EmptyState title={t("node.empty.leafTitle")} description={t("node.empty.leafDescription")} />
            </div>
          )}
        </div>
      </div>

      {/* Minimap (chart only) */}
      {view === "chart" && (
        <div className="hw-minimap" ref={minimapRef} onPointerDown={jumpMinimap} aria-hidden />
      )}

      {/* Modals */}
      {nodeModal?.mode === "add" && (() => {
        const parent = byId.get(nodeModal.nodeId);
        const cl = parent ? childLevelOf(parent) : null;
        if (!cl) return null;
        return (
          <NodeNameModal
            title={t("modal.add.title", { label: cl.label })}
            label={t("modal.add.nameLabel", { label: cl.label })}
            submitLabel={t("modal.add.submit")}
            saving={saving}
            onSubmit={submitNodeModal}
            onClose={() => setNodeModal(null)}
          />
        );
      })()}
      {nodeModal?.mode === "rename" && (() => {
        const n = byId.get(nodeModal.nodeId);
        if (!n) return null;
        return (
          <NodeNameModal
            title={t("modal.rename.title", { label: n.level.label })}
            label={t("modal.rename.nameLabel")}
            initialValue={n.name}
            submitLabel={t("modal.rename.submit")}
            saving={saving}
            onSubmit={submitNodeModal}
            onClose={() => setNodeModal(null)}
          />
        );
      })()}
      {moveNodeFor && (
        <MoveNodeModal
          nodeName={moveNodeFor.name}
          targets={moveTargetsForSelected}
          saving={saving}
          onSubmit={submitMoveNode}
          onClose={() => setMoveNodeFor(null)}
        />
      )}
      <ConfirmDialog
        open={!!deleteFor}
        title={deleteFor ? t("delete.title", { name: deleteFor.name }) : ""}
        message={t("delete.message")}
        confirmLabel={t("delete.confirm")}
        variant="danger"
        loading={saving}
        onConfirm={doDeleteNode}
        onCancel={() => setDeleteFor(null)}
      />
      <ConfirmDialog
        open={!!confirmMove}
        title={confirmMove ? t("dragMove.title", { name: confirmMove.node.name, target: confirmMove.target.name }) : ""}
        message={t("dragMove.message")}
        confirmLabel={t("dragMove.confirm")}
        loading={saving}
        onConfirm={() => {
          confirmMove?.run();
          setConfirmMove(null);
        }}
        onCancel={() => setConfirmMove(null)}
      />

      <AddMemberModal
        key={addMemberFor ?? "none"}
        nodeId={addMemberFor}
        roles={addMemberFor ? rolesAt(byId.get(addMemberFor) ?? selected) : []}
        onClose={() => setAddMemberFor(null)}
        onAdded={(c) => {
          const nid = addMemberFor;
          setAddMemberFor(null);
          if (c) setCreds(c);
          if (nid) void loadMembers(nid);
          router.refresh();
        }}
      />
      <CredentialsDialog creds={creds} onClose={() => setCreds(null)} />

      <MoveMemberModal
        key={moveMemberFor?.assignmentId ?? "none"}
        member={moveMemberFor}
        roles={roles}
        nodes={nodes}
        onClose={() => setMoveMemberFor(null)}
        onMoved={(targetNodeId) => {
          const from = moveMemberFor?.nodeId;
          setMoveMemberFor(null);
          if (from) void loadMembers(from);
          if (targetNodeId) void loadMembers(targetNodeId);
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={!!removeMemberFor}
        title={removeMemberFor ? t("remove.title", { name: removeMemberFor.name }) : t("remove.titleFallback")}
        message={t("remove.message")}
        confirmLabel={t("remove.confirm")}
        variant="danger"
        loading={saving}
        onConfirm={doRemoveMember}
        onCancel={() => setRemoveMemberFor(null)}
      />
    </div>
  );
}

// Inline "type-to-create" row used under each expandable tree node.
function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (name: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <div className="hw-addrow">
      <span className="hw-plus" aria-hidden>＋</span>
      <input
        className="hw-qinput"
        value={value}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            const name = value.trim();
            if (name) {
              onAdd(name);
              setValue("");
            }
          }
        }}
      />
    </div>
  );
}

const CHART_CSS = `
.hw { --hw-accent:#2f55ea; --hw-line:#e2e8f0; --hw-line-soft:#eef2f7; --hw-ink:#0f172a; --hw-muted:#64748b; --hw-faint:#94a3b8; --hw-good:#16a34a; --hw-good-soft:#e8f6ec; }
.hw .font-num { font-variant-numeric: tabular-nums; }

/* Tree */
.hw-tree { font-size: 14px; }
.hw-node.hw-invalid > .hw-row, .hw-node.hw-invalid > .hw-box { opacity: .4; }
.hw-row { display:flex; align-items:center; gap:8px; padding:5px 8px; border-radius:9px; min-height:34px; cursor:pointer; position:relative; }
.hw-row:hover { background: rgba(15,23,42,.04); }
.hw-row.hw-selected { background: rgba(47,85,234,.07); box-shadow: inset 0 0 0 1px rgba(47,85,234,.25); }
.hw-node.hw-valid > .hw-row { box-shadow: inset 0 0 0 1.5px var(--hw-good); background: var(--hw-good-soft); }
.hw-node.hw-over > .hw-row { box-shadow: inset 0 0 0 2px var(--hw-good); }
.hw-node.hw-match > .hw-row { box-shadow: inset 0 0 0 2px var(--hw-accent); background: rgba(47,85,234,.06); }
.hw-tw { width:18px; height:18px; flex:0 0 auto; display:grid; place-items:center; border:0; background:transparent; color:var(--hw-faint); font-size:10px; cursor:pointer; border-radius:5px; }
.hw-tw:hover { color: var(--hw-ink); background: rgba(15,23,42,.05); }
.hw-tw.hw-ph { visibility:hidden; }
.hw-grip { color:var(--hw-faint); cursor:grab; font-size:14px; user-select:none; }
.hw-grip.hw-ph { opacity:.4; cursor:default; }
.hw-name { font-weight:600; color:var(--hw-ink); }
.hw-count { font-variant-numeric: tabular-nums; font-size:11px; color:var(--hw-faint); }
.hw-sp { flex:1; }
.hw-ico { border:0; background:transparent; color:var(--hw-faint); cursor:pointer; font-size:13px; padding:2px 6px; border-radius:6px; }
.hw-ico:hover { color:var(--hw-accent); background: rgba(47,85,234,.08); }
.hw-ico.hw-danger:hover { color:#e5484d; background: rgba(229,72,77,.1); }
.hw-children { margin-inline-start:17px; padding-inline-start:14px; border-inline-start:1.5px solid var(--hw-line-soft); }
.hw-people { display:flex; flex-direction:column; }
.hw-prow { display:flex; align-items:center; gap:8px; padding:3px 8px; border-radius:9px; min-height:30px; }
.hw-prow:hover { background: rgba(15,23,42,.04); }
.hw-prow.hw-match { box-shadow: inset 0 0 0 1.5px var(--hw-accent); background: rgba(47,85,234,.06); }
.hw-avatar { width:20px; height:20px; border-radius:50%; display:grid; place-items:center; font-size:10px; font-weight:700; background: rgba(47,85,234,.1); color:var(--hw-accent); flex:0 0 auto; }
.hw-pname { font-size:13px; color:var(--hw-ink); }
.hw-addrow { display:flex; align-items:center; gap:6px; padding:2px 8px 4px; min-height:30px; }
.hw-plus { color:var(--hw-accent); font-weight:700; font-size:14px; width:18px; text-align:center; }
.hw-qinput { flex:0 1 240px; font:inherit; font-size:13px; padding:5px 9px; border-radius:8px; border:1px dashed var(--hw-line); background:transparent; color:var(--hw-ink); outline:none; }
.hw-qinput::placeholder { color:var(--hw-faint); }
.hw-qinput:focus { border-style:solid; border-color:var(--hw-accent); background:#fff; }
.hw-addperson { display:block; margin:2px 0 0; border:0; background:transparent; color:var(--hw-accent); font:inherit; font-size:12px; padding:4px 8px; border-radius:8px; cursor:pointer; }
.hw-addperson:hover { background: rgba(47,85,234,.08); }

/* Org chart */
.hw-canvas { overflow:auto; padding:26px 8px 28px; cursor:grab; max-height: calc(100vh - 12rem); }
.hw-canvas.hw-panning { cursor:grabbing; }
.hw-stage { transform-origin: top center; width: max-content; margin: 0 auto; transition: transform .12s ease; }
.hw-chart ul { margin:0; padding:0; list-style:none; position:relative; padding-top:24px; display:flex; justify-content:center; }
.hw-chart, .hw-chart > ul { text-align:center; }
.hw-chart > ul { padding-top:0; }
.hw-chart li { position:relative; list-style:none; padding:24px 12px 0; display:flex; flex-direction:column; align-items:center; }
.hw-chart li::before, .hw-chart li::after { content:""; position:absolute; top:0; right:50%; width:50%; height:24px; border-top:2px solid var(--hw-line); }
.hw-chart li::after { right:auto; left:50%; border-left:2px solid var(--hw-line); }
.hw-chart li:only-child { padding-top:0; }
.hw-chart li:only-child::before, .hw-chart li:only-child::after { display:none; }
.hw-chart li:first-child::before, .hw-chart li:last-child::after { border:0 none; }
.hw-chart li:last-child::before { border-right:2px solid var(--hw-line); border-radius:0 8px 0 0; }
.hw-chart li:first-child::after { border-radius:8px 0 0 0; }
.hw-chart ul ul::before { content:""; position:absolute; top:0; left:50%; border-left:2px solid var(--hw-line); width:0; height:24px; }
.hw-chart > ul > li { padding-top:0; }
.hw-box { position:relative; background:#fff; border:1px solid var(--hw-line); border-radius:13px; box-shadow: 0 4px 14px -6px rgba(16,24,40,.16); min-width:150px; max-width:210px; padding:10px 12px; text-align:start; cursor:grab; transition: box-shadow .12s, background .12s, opacity .12s; }
.hw-box:active { cursor:grabbing; }
.hw-box.hw-selected { box-shadow: 0 0 0 2px rgba(47,85,234,.4), 0 4px 14px -6px rgba(16,24,40,.16); }
.hw-box.hw-valid { box-shadow: inset 0 0 0 2px var(--hw-good), 0 4px 14px -6px rgba(16,24,40,.16); background: var(--hw-good-soft); }
.hw-box.hw-over { box-shadow: 0 0 0 3px var(--hw-good-soft), inset 0 0 0 2px var(--hw-good); background: var(--hw-good-soft); }
.hw-box.hw-invalid { opacity:.4; }
.hw-box.hw-match { box-shadow: 0 0 0 2px var(--hw-accent), 0 4px 14px -6px rgba(16,24,40,.16); }
.hw-box-top { display:flex; align-items:center; gap:6px; }
.hw-box-name { font-weight:650; font-size:14px; margin-top:3px; color:var(--hw-ink); }
.hw-box-meta { display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; font-variant-numeric:tabular-nums; font-size:10.5px; color:var(--hw-faint); }
.hw-box-acts { position:absolute; top:-11px; inset-inline-end:8px; display:flex; gap:4px; opacity:0; transition:opacity .12s; }
.hw-box:hover .hw-box-acts { opacity:1; }
.hw-box-acts button { width:22px; height:22px; border-radius:7px; border:1px solid var(--hw-line); background:#fff; color:var(--hw-muted); font-size:12px; cursor:pointer; display:grid; place-items:center; box-shadow: 0 1px 2px rgba(16,24,40,.06); }
.hw-box-acts button:hover { color:var(--hw-accent); border-color:var(--hw-accent); }
.hw-box-acts button.hw-danger:hover { color:#e5484d; border-color:#e5484d; }
.hw-collapse-tab { position:absolute; bottom:-11px; inset-inline-start:50%; transform:translateX(-50%); background:#fff; border:1px solid var(--hw-line); border-radius:999px; font-size:10px; font-variant-numeric:tabular-nums; color:var(--hw-muted); padding:1px 8px; cursor:pointer; box-shadow: 0 1px 2px rgba(16,24,40,.06); white-space:nowrap; }
.hw-collapse-tab:hover { color:var(--hw-accent); border-color:var(--hw-accent); }

/* Minimap */
.hw-minimap { position:fixed; inset-inline-end:18px; inset-block-end:18px; width:184px; height:130px; background:#fff; border:1px solid var(--hw-line); border-radius:12px; box-shadow: 0 22px 44px -20px rgba(16,24,40,.4); overflow:hidden; z-index:30; cursor:pointer; }
.hw-mm-label { position:absolute; top:3px; inset-inline-start:7px; font-size:9px; font-variant-numeric:tabular-nums; color:var(--hw-faint); z-index:2; pointer-events:none; }
.hw-mm-inner { position:absolute; top:0; inset-inline-start:0; transform-origin: top left; pointer-events:none; }
.hw-mm-view { position:absolute; top:0; inset-inline-start:0; border:1.5px solid var(--hw-accent); background: rgba(47,85,234,.14); border-radius:3px; pointer-events:none; }

@media (max-width: 1023px) {
  .hw-minimap { display:none; }
}
@media (prefers-reduced-motion: reduce) { .hw-stage { transition:none; } }
`;
