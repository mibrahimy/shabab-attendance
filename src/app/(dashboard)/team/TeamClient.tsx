"use client";

import { useState, useMemo } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Modal from "@/components/ui/Modal";
import EmptyState from "@/components/ui/EmptyState";
import SearchInput from "@/components/ui/SearchInput";
import MemberNode from "@/components/team/MemberNode";
import MemberDetail from "@/components/team/MemberDetail";
import AddMemberForm from "@/components/team/AddMemberForm";
import type { ParkOption, MemberOption } from "@/types";
import type { MemberNodeData } from "@/components/team/MemberNode";

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

export default function TeamClient({ members, parks, allMembers }: TeamClientProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [selected, setSelected] = useState<MemberNodeData | null>(null);
  const [search, setSearch] = useState("");

  const filteredMembers = useMemo(() => filterTree(members, search), [members, search]);

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
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search by name or position..."
          className="mb-4"
        />
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
        ) : filteredMembers.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-8">
            No members matching &ldquo;{search}&rdquo;
          </p>
        ) : (
          <div className="py-2">
            {filteredMembers.map((member) => (
              <MemberNode
                key={member.id}
                member={member}
                onSelect={setSelected}
              />
            ))}
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
          member={selected}
          onClose={() => setSelected(null)}
          parks={parks}
          allMembers={allMembers}
        />
      )}
    </div>
  );
}
