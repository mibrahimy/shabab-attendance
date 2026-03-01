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

export interface FlatMember {
  member: MemberNodeData;
  depth: number;
  hasChildren: boolean;
}

/** Flatten tree into a list with depth info for table rendering */
export function flattenTree(nodes: MemberNodeData[], depth = 0, result: FlatMember[] = []): FlatMember[] {
  for (const node of nodes) {
    result.push({ member: node, depth, hasChildren: node.children.length > 0 });
    flattenTree(node.children, depth + 1, result);
  }
  return result;
}
