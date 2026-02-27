import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserSubTreeMemberIds } from "@/lib/team-tree";
import { redirect } from "next/navigation";
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
  const session = await getSession();
  if (!session) redirect("/login");

  // Fire parks query immediately — doesn't depend on scope
  const parksPromise = prisma.park.findMany({ orderBy: { name: "asc" } });

  let allMembersWithPark: MemberWithPark[];

  if (isAdmin(session.roles)) {
    // Admins see the full tree — fetch members in parallel with parks
    allMembersWithPark = await prisma.member.findMany({
      include: {
        park: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  } else {
    // Non-admins only see their own sub-tree
    const subTreeIds = await getUserSubTreeMemberIds(session.id);

    if (!subTreeIds || subTreeIds.length === 0) {
      return <TeamClient members={[]} parks={await parksPromise} allMembers={[]} />;
    }

    allMembersWithPark = await prisma.member.findMany({
      where: { id: { in: subTreeIds } },
      include: {
        park: true,
        user: { select: { id: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  const members = buildTree(allMembersWithPark);

  const allMembers = allMembersWithPark.map((m) => ({
    id: m.id,
    name: m.name,
    positionLabel: m.positionLabel,
  }));

  const parks = await parksPromise;
  return <TeamClient members={members} parks={parks} allMembers={allMembers} />;
}
