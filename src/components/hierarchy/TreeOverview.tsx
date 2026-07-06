"use client";

// Whole-tree overview for an existing hierarchy: an expand/collapse outline of
// every node, plus a search that jumps to any location by name. Operates purely on
// the already-loaded node list (no fetching). Clicking a node calls onJump, which
// the builder uses to focus that node for viewing/editing.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import Badge from "@/components/ui/Badge";
import { levelColor } from "@/lib/level-colors";
import { matchNodes, breadcrumb } from "@/lib/tree-nav";
import type { BuilderNode } from "./HierarchyBuilder";

export function TreeOverview({
  nodes,
  byId,
  childrenOf,
  rootId,
  onJump,
}: {
  nodes: BuilderNode[];
  byId: Map<string, BuilderNode>;
  childrenOf: Map<string, BuilderNode[]>;
  rootId: string;
  onJump: (nodeId: string) => void;
}) {
  const { t } = useTranslation("hierarchy");
  const [query, setQuery] = useState("");
  // Default: everything expanded so the shape is visible at a glance.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(nodes.map((n) => n.id)));

  const matches = useMemo(() => matchNodes(nodes, query), [nodes, query]);
  const searching = query.trim().length > 0;

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderRow(node: BuilderNode, depth: number) {
    const kids = childrenOf.get(node.id) ?? [];
    const isOpen = expanded.has(node.id);
    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 rounded-lg py-1.5 hover:bg-gray-50"
          style={{ paddingInlineStart: `${depth * 16}px` }}
        >
          {kids.length > 0 ? (
            <button
              onClick={() => toggle(node.id)}
              aria-label={isOpen ? "Collapse" : "Expand"}
              className="flex h-5 w-5 shrink-0 items-center justify-center text-gray-400 hover:text-gray-700"
            >
              <span className={`transition-transform ${isOpen ? "rotate-90" : ""}`}>›</span>
            </button>
          ) : (
            <span className="h-5 w-5 shrink-0" />
          )}
          <button
            onClick={() => onJump(node.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-start"
          >
            <Badge color={levelColor(node.level.key)}>{node.level.label}</Badge>
            <span className="truncate text-sm font-medium text-gray-900">{node.name}</span>
            {kids.length > 0 && (
              <span className="shrink-0 font-mono text-xs text-gray-400">
                {t("overview.children", { count: kids.length })}
              </span>
            )}
          </button>
        </div>
        {isOpen && kids.map((child) => renderRow(child, depth + 1))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-3">
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("overview.search")}
        className="mb-2 w-full rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm text-gray-900 outline-none transition focus:border-[#2f55ea] focus:ring-2 focus:ring-[#2f55ea]/20"
      />

      {searching ? (
        matches.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-gray-400">
            {t("overview.noMatches", { query: query.trim() })}
          </p>
        ) : (
          <ul>
            {matches.map((n) => (
              <li key={n.id}>
                <button
                  onClick={() => onJump(n.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-start hover:bg-gray-50"
                >
                  <Badge color={levelColor(n.level.key)}>{n.level.label}</Badge>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium text-gray-900">{n.name}</span>
                    {breadcrumb(byId, n).length > 0 && (
                      <span className="block truncate text-xs text-gray-400">
                        {breadcrumb(byId, n).join(" / ")}
                      </span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        renderRow(byId.get(rootId)!, 0)
      )}
    </div>
  );
}
