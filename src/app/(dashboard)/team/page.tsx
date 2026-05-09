import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import { getUserSubTreeMemberIds, getUserManagedParkIds } from "@/lib/team-tree";
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

  // Fire parks and managed-park-ids queries in parallel
  const admin = isAdmin(session.roles);
  const [allParks, managedParkIds] = await Promise.all([
    prisma.park.findMany({ orderBy: { name: "asc" } }),
    admin ? Promise.resolve([] as string[]) : getUserManagedParkIds(session.id),
  ]);

  const canManageMembers = admin || managedParkIds.length > 0;

  let allMembersWithPark: MemberWithPark[];

  if (admin) {
    allMembersWithPark = await prisma.member.findMany({
      include: { park: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  } else if (managedParkIds.length > 0) {
    // Park managers see all members in their park(s)
    allMembersWithPark = await prisma.member.findMany({
      where: { parkId: { in: managedParkIds } },
      include: { park: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  } else {
    // Regular non-admins only see their own sub-tree
    const subTreeIds = await getUserSubTreeMemberIds(session.id);
    if (!subTreeIds || subTreeIds.length === 0) {
      return <TeamClient members={[]} parks={allParks} allMembers={[]} canManageMembers={false} />;
    }
    allMembersWithPark = await prisma.member.findMany({
      where: { id: { in: subTreeIds } },
      include: { park: true, user: { select: { id: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });
  }

  const members = buildTree(allMembersWithPark);
  const allMembers = allMembersWithPark.map((m) => ({
    id: m.id,
    name: m.name,
    positionLabel: m.positionLabel,
  }));

  // Park managers only see their own parks in dropdowns; admins see all
  const parks = managedParkIds.length > 0 && !admin
    ? allParks.filter((p) => managedParkIds.includes(p.id))
    : allParks;

  return <TeamClient members={members} parks={parks} allMembers={allMembers} canManageMembers={canManageMembers} />;
}
