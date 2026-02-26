"use client";

import { useState } from "react";
import Badge from "@/components/ui/Badge";
import { getInitials } from "@/lib/utils";

export interface MemberNodeData {
  id: string;
  name: string;
  positionLabel: string;
  isTeaching: boolean;
  classAssignment: string | null;
  canManageTeam: boolean;
  phone: string | null;
  park?: { id: string; name: string } | null;
  children: MemberNodeData[];
}

interface MemberNodeProps {
  member: MemberNodeData;
  depth?: number;
  onSelect: (member: MemberNodeData) => void;
}

export default function MemberNode({ member, depth = 0, onSelect }: MemberNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = member.children.length > 0;

  return (
    <div>
      <div
        className="flex items-center gap-2 py-2 px-3 rounded-lg hover:bg-gray-50 cursor-pointer transition-all duration-150 active:scale-[0.99] group"
        style={{ paddingLeft: `${depth * 20 + 12}px` }}
        onClick={() => onSelect(member)}
      >
        {hasChildren ? (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setExpanded(!expanded);
            }}
            className="min-w-[28px] min-h-[28px] flex items-center justify-center text-gray-400 hover:text-gray-600"
          >
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${expanded ? "rotate-90" : ""}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ) : (
          <span className="min-w-[28px]" />
        )}

        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-medium shrink-0">
          {getInitials(member.name)}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {member.name}
            </span>
            {member.isTeaching && member.classAssignment && (
              <Badge color="blue">{member.classAssignment}</Badge>
            )}
          </div>
          <span className="text-xs text-gray-500">{member.positionLabel}</span>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {member.children.map((child) => (
            <MemberNode
              key={child.id}
              member={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
