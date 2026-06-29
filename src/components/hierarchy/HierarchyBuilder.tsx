"use client";

// Mobile-first drill-down navigator for one city's tree. Reads a flat subtree +
// the city's level template, builds the tree client-side, and supports
// add-child / rename / guarded-delete. Reads well on desktop (centered column).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import type { BadgeColor } from "@/types";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { nextLevel, type Level } from "@/lib/org-levels";
import { NodeNameModal } from "./NodeNameModal";

export type BuilderNode = {
  id: string;
  name: string;
  parentId: string | null;
  level: { key: string; label: string; rank: number };
};

const LEVEL_COLORS: Record<string, BadgeColor> = {
  city: "slate",
  zone: "blue",
  sector: "pink",
  park: "green",
  class: "amber",
};

export function HierarchyBuilder({
  city,
  levels,
  nodes,
}: {
  city: { id: string; name: string };
  levels: Level[];
  nodes: BuilderNode[];
}) {
  const router = useRouter();
  const { toast } = useToast();

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

  const [modal, setModal] = useState<"add" | "rename" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);

  // Breadcrumb: walk up to the city root (parents above the city aren't loaded).
  const trail: BuilderNode[] = [];
  for (let n: BuilderNode | undefined = current; n; n = n.parentId ? byId.get(n.parentId) : undefined) {
    trail.unshift(n);
  }

  const children = childrenOf.get(current.id) ?? [];
  const childLevel = nextLevel(levels, current.level.rank);
  const isCityRoot = current.id === city.id;

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
        toast(json?.error?.message ?? "Something went wrong", "error");
        return false;
      }
      return true;
    } catch {
      toast("Network error", "error");
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function addChild(name: string) {
    if (await call("/api/org-nodes", "POST", { parentId: current.id, name })) {
      toast(`Added ${name}`);
      setModal(null);
      router.refresh();
    }
  }

  async function rename(name: string) {
    if (await call(`/api/org-nodes/${current.id}`, "PATCH", { name })) {
      toast("Renamed");
      setModal(null);
      router.refresh();
    }
  }

  async function remove() {
    if (await call(`/api/org-nodes/${current.id}`, "DELETE")) {
      toast("Deleted");
      setConfirmDelete(false);
      if (current.parentId) setCurrentId(current.parentId);
      router.refresh();
    } else {
      setConfirmDelete(false);
    }
  }

  return (
    <div>
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
      <div className="mb-4 rounded-2xl border border-gray-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight text-gray-900">{current.name}</h1>
              <Badge color={LEVEL_COLORS[current.level.key] ?? "gray"}>{current.level.label}</Badge>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" variant="secondary" onClick={() => setModal("rename")}>
              Rename
            </Button>
            {!isCityRoot && (
              <Button size="sm" variant="danger" onClick={() => setConfirmDelete(true)}>
                Delete
              </Button>
            )}
          </div>
        </div>
        {childLevel && (
          <div className="mt-4">
            <Button size="sm" onClick={() => setModal("add")}>
              + Add {childLevel.label}
            </Button>
          </div>
        )}
      </div>

      {/* Children */}
      {children.length === 0 ? (
        <EmptyState
          title={childLevel ? `No ${childLevel.label.toLowerCase()}s yet` : "Nothing under here"}
          description={
            childLevel
              ? `Add the first ${childLevel.label.toLowerCase()} to keep building.`
              : "This is the deepest level."
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
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3 text-left transition hover:border-gray-300 hover:bg-gray-50"
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

      {modal === "add" && childLevel && (
        <NodeNameModal
          title={`Add ${childLevel.label}`}
          label={`${childLevel.label} name`}
          submitLabel="Add"
          saving={saving}
          onSubmit={addChild}
          onClose={() => setModal(null)}
        />
      )}
      {modal === "rename" && (
        <NodeNameModal
          title={`Rename ${current.level.label}`}
          label="Name"
          initialValue={current.name}
          submitLabel="Save"
          saving={saving}
          onSubmit={rename}
          onClose={() => setModal(null)}
        />
      )}
      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${current.name}?`}
        message="This can't be undone. A node with child nodes or assigned people can't be deleted."
        confirmLabel="Delete"
        variant="danger"
        loading={saving}
        onConfirm={remove}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}
