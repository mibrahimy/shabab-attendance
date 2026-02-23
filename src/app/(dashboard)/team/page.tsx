import { prisma } from "@/lib/db";
import TeamClient from "./TeamClient";
import type { MemberWithChildren } from "@/types";
import type { Member, Park } from "@prisma/client";

type MemberWithPark = Member & { park: Park | null; user?: { id: string; email: string } | null };

function buildTree(flatMembers: MemberWithPark[]): MemberWithChildren[] {
  const map = new Map<string, MemberWithChildren>();

  // First pass: create nodes with empty children
  for (const m of flatMembers) {
    map.set(m.id, { ...m, children: [] });
  }

  // Second pass: link children to parents
  const roots: MemberWithChildren[] = [];
  for (const node of map.values()) {
    if (node.parentId && map.has(node.parentId)) {
      map.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

export default async function TeamPage() {
  const [allMembersWithPark, parks] = await Promise.all([
    prisma.member.findMany({
      include: {
        park: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.park.findMany({ orderBy: { name: "asc" } }),
  ]);

  const members = buildTree(allMembersWithPark);

  const allMembers = allMembersWithPark.map((m) => ({
    id: m.id,
    name: m.name,
    positionLabel: m.positionLabel,
  }));

  return <TeamClient members={members} parks={parks} allMembers={allMembers} />;
}
