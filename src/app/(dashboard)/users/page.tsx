import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/roles";
import UsersClient from "./UsersClient";

export default async function UsersPage() {
  const session = await getSession();
  if (!session || !isAdmin(session.roles)) {
    redirect("/dashboard");
  }

  const [users, unlinkedMembers] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        roles: true,
        isActive: true,
        memberships: {
          select: {
            id: true,
            name: true,
            positionLabel: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.member.findMany({
      where: { userId: null },
      select: {
        id: true,
        name: true,
        positionLabel: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <UsersClient
      users={users}
      unlinkedMembers={unlinkedMembers}
      currentUserId={session.id}
      isSuperAdmin={session.roles === "super_admin"}
    />
  );
}
