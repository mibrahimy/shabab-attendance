"use client";

import { useState, useMemo } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import SearchInput from "@/components/ui/SearchInput";
import Badge from "@/components/ui/Badge";
import MemberDetail from "@/components/team/MemberDetail";
import AddMemberForm from "@/components/team/AddMemberForm";
import { getInitials } from "@/lib/utils";
import type { ParkOption, MemberOption } from "@/types";
import type { MemberNodeData } from "@/components/team/MemberNode";
import { flattenTree } from "@/components/team/MemberNode";

function filterTree(nodes: MemberNodeData[], query: string): MemberNodeData[] {
  if (!query) return nodes;
  const q = query.toLowerCase();
  return nodes.reduce<MemberNodeData[]>((acc, node) => {
    const selfMatch =
      node.name.toLowerCase().includes(q) ||
      node.positionLabel.toLowerCase().includes(q);
    const filteredChildren = filterTree(node.children, query);
    if (selfMatch || filteredChildren.length > 0) {
      acc.push({ ...node, children: selfMatch ? node.children : filteredChildren });
    }
    return acc;
  }, []);
}

interface TeamClientProps {
  members: MemberNodeData[];
  parks: ParkOption[];
  allMembers: MemberOption[];
}

const selectClass = "rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

export default function TeamClient({ members, parks, allMembers }: TeamClientProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<MemberNodeData | null>(null);
  const [search, setSearch] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Filters
  const [zoneFilter, setZoneFilter] = useState("");
  const [positionFilter, setPositionFilter] = useState("");
  const [parkFilter, setParkFilter] = useState("");

  // Zone options = root-level members
  const zoneOptions = useMemo(
    () => members.map((m) => ({ id: m.id, name: m.name })),
    [members],
  );

  // Flat list of all members (unfiltered) — used to derive position options
  const allFlat = useMemo(() => flattenTree(members), [members]);

  // Position options from all members
  const positionOptions = useMemo(
    () => [...new Set(allFlat.map((r) => r.member.positionLabel))].sort(),
    [allFlat],
  );

  const hasFlatFilters = !!(positionFilter || parkFilter);
  const hasActiveFilters = search || zoneFilter || hasFlatFilters;

  const filteredMembers = useMemo(() => {
    let tree = members;

    // Zone filter — keep only the matching root sub-tree
    if (zoneFilter) {
      tree = tree.filter((m) => m.id === zoneFilter);
    }

    // Text search
    tree = filterTree(tree, search);

    return tree;
  }, [members, search, zoneFilter]);

  const flatRows = useMemo(() => {
    let rows = flattenTree(filteredMembers);

    // Position filter — keep rows matching the position
    if (positionFilter) {
      rows = rows.filter((r) => r.member.positionLabel === positionFilter);
    }

    // Park filter — keep rows matching the park
    if (parkFilter) {
      rows = rows.filter((r) => r.member.park?.id === parkFilter);
    }

    // Apply collapse visibility (skip when flat filters are active — tree structure is broken)
    if (!hasFlatFilters) {
      const hidden = new Set<string>();
      const result: typeof rows = [];
      const markHidden = (node: MemberNodeData) => {
        for (const child of node.children) {
          hidden.add(child.id);
          markHidden(child);
        }
      };
      for (const row of rows) {
        if (hidden.has(row.member.id)) continue;
        result.push(row);
        if (collapsed.has(row.member.id)) {
          markHidden(row.member);
        }
      }
      return result;
    }

    return rows;
  }, [filteredMembers, collapsed, positionFilter, parkFilter, hasFlatFilters]);

  function toggleCollapse(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearFilters() {
    setZoneFilter("");
    setPositionFilter("");
    setParkFilter("");
    setSearch("");
  }

  const noResults = members.length > 0 && flatRows.length === 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl lg:text-2xl font-semibold text-gray-900">Team</h1>
        <Button onClick={() => setShowAdd(true)}>
          <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Member
        </Button>
      </div>

      {members.length > 0 && (
        <div className="space-y-3 mb-4">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by name or position..."
          />

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={zoneFilter}
              onChange={(e) => setZoneFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Zones</option>
              {zoneOptions.map((z) => (
                <option key={z.id} value={z.id}>{z.name}</option>
              ))}
            </select>

            <select
              value={positionFilter}
              onChange={(e) => setPositionFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Positions</option>
              {positionOptions.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>

            <select
              value={parkFilter}
              onChange={(e) => setParkFilter(e.target.value)}
              className={selectClass}
            >
              <option value="">All Parks</option>
              {parks.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 px-2 py-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>
      )}

      <Card className="!p-0 lg:!p-0">
        {members.length === 0 ? (
          <EmptyState
            title="No team members yet"
            description="Add your first team member to build the hierarchy."
            icon={
              <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            }
            action={
              <Button onClick={() => setShowAdd(true)} size="sm">
                Add First Member
              </Button>
            }
          />
        ) : noResults ? (
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">
              No members match the current filters.
            </p>
            <button
              onClick={clearFilters}
              className="text-sm text-blue-600 hover:text-blue-800 mt-2"
            >
              Clear all filters
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-4 py-3 font-medium text-gray-600">Name</th>
                  <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Position</th>
                  <th className="px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Park</th>
                  <th className="px-4 py-3 font-medium text-gray-600 hidden lg:table-cell">Phone</th>
                  <th className="px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Class</th>
                </tr>
              </thead>
              <tbody>
                {flatRows.map(({ member, depth, hasChildren }) => {
                  const isCollapsed = collapsed.has(member.id);
                  return (
                    <tr
                      key={member.id}
                      className="border-b border-gray-100 last:border-0 hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => setSelected(member)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 20}px` }}>
                          {hasChildren && !hasFlatFilters ? (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleCollapse(member.id);
                              }}
                              className="w-5 h-5 flex items-center justify-center text-gray-400 hover:text-gray-600 shrink-0"
                            >
                              <svg
                                className={`w-3.5 h-3.5 transition-transform duration-200 ${isCollapsed ? "" : "rotate-90"}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          ) : (
                            <span className="w-5 shrink-0" />
                          )}
                          <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px] font-medium shrink-0">
                            {getInitials(member.name)}
                          </div>
                          <div className="min-w-0">
                            <span className="font-medium text-gray-900 truncate block">
                              {member.name}
                            </span>
                            <span className="text-xs text-gray-500 sm:hidden">{member.positionLabel}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden sm:table-cell">
                        {member.positionLabel}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden md:table-cell">
                        {member.park?.name || <span className="text-gray-300">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 text-gray-600 hidden lg:table-cell">
                        {member.phone || <span className="text-gray-300">&mdash;</span>}
                      </td>
                      <td className="px-4 py-3 hidden sm:table-cell">
                        {member.isTeaching && member.classAssignment ? (
                          <Badge color="blue">{member.classAssignment}</Badge>
                        ) : member.isTeaching ? (
                          <Badge color="gray">Teaching</Badge>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        title="Add Team Member"
      >
        <AddMemberForm
          parks={parks}
          members={allMembers}
          onDone={() => setShowAdd(false)}
        />
      </Modal>

      {selected && (
        <MemberDetail
          key={selected.id}
          member={selected}
          onClose={() => setSelected(null)}
          parks={parks}
          allMembers={allMembers}
        />
      )}
    </div>
  );
}
