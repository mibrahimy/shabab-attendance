// Direct-add of members (the trusted, no-approval path). Adding is gated by
// add_member scoped to the target node's subtree; students are profile-only,
// staff get a login with a generated temp password.

import { prisma } from "@/server/db";
import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import { hashPassword } from "@/server/auth/password";
import { generateTempPassword } from "@/lib/password-generate";
import { findRole } from "@/lib/default-roles";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as positionRepo from "@/server/repositories/position-repo";
import * as personRepo from "@/server/repositories/person-repo";
import * as userRepo from "@/server/repositories/user-repo";
import * as assignmentRepo from "@/server/repositories/assignment-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const ADD_MEMBER = "add_member";

type Segment = "junior" | "senior";

export function listNodeMembers(
  ctx: AuthzContext,
  nodeId: string,
): Promise<assignmentRepo.NodeMember[]> {
  return loadAuthorizedNode(ctx, nodeId).then((node) =>
    assignmentRepo.listActiveByNode(node.id),
  );
}

export type AddMemberResult = {
  personId: string;
  tempPassword?: string; // only for staff (accounts)
};

export async function addMember(
  ctx: AuthzContext,
  input: {
    nodeId: string;
    roleKey: string;
    person: { name: string; cnic?: string | null; phone?: string | null; segment?: Segment | null };
  },
): Promise<AddMemberResult> {
  const node = await loadAuthorizedNode(ctx, input.nodeId);
  if (!node.cityId) throw new ValidationError("Members attach below the city level");

  const role = findRole(input.roleKey);
  if (!role) throw new ValidationError("Unknown role");

  // The role must be valid for this node's level (e.g. Student/Murabbi at a Class).
  const levels = await nodeTypeRepo.listCityLevels(node.cityId);
  const nodeLevel = levels.find((l) => l.id === node.typeId);
  if (!nodeLevel || nodeLevel.key !== role.attachLevelKey) {
    throw new ValidationError(`${role.label} can't be added at this level`);
  }

  const name = input.person.name.trim();
  if (!name) throw new ValidationError("Name is required");

  // Profile-only student: no User, CNIC optional.
  if (role.isStudent) {
    const person = await personRepo.create({
      name,
      segment: input.person.segment ?? null,
      status: "active",
      cityId: node.cityId,
    });
    const position = await positionRepo.findOrCreateRolePosition(
      node.cityId,
      role.canonicalKey,
      role.permissionKeys,
    );
    await assignmentRepo.create({
      personId: person.id,
      positionId: position.id,
      orgNodeId: node.id,
      cityId: node.cityId,
    });
    await recordAudit(ctx, node, person.id, role.canonicalKey, false);
    return { personId: person.id };
  }

  // Staff: needs a CNIC (login username) and a temp-password account.
  const cnic = input.person.cnic?.trim();
  if (!cnic) throw new ValidationError("CNIC is required for staff");
  if (await personRepo.findByCnic(cnic)) {
    throw new ValidationError("A person with this CNIC already exists", "CNIC_TAKEN");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  const personId = await prisma.$transaction(
    async (tx) => {
      const person = await personRepo.create(
        { name, cnic, phone: input.person.phone ?? null, segment: input.person.segment ?? null, status: "active", cityId: node.cityId },
        tx,
      );
      await userRepo.create({ personId: person.id, passwordHash, mustChangePassword: true }, tx);
      const position = await positionRepo.findOrCreateRolePosition(
        node.cityId!,
        role.canonicalKey,
        role.permissionKeys,
        tx,
      );
      await assignmentRepo.create(
        { personId: person.id, positionId: position.id, orgNodeId: node.id, cityId: node.cityId },
        tx,
      );
      return person.id;
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  await recordAudit(ctx, node, personId, role.canonicalKey, true);
  return { personId, tempPassword };
}

async function loadAuthorizedNode(
  ctx: AuthzContext,
  nodeId: string,
): Promise<orgNodeRepo.OrgNodeRow> {
  const node = await orgNodeRepo.findById(nodeId);
  if (!node) throw new NotFoundError("Node not found");
  requirePermission(ctx, ADD_MEMBER, { path: node.path, functionId: null });
  return node;
}

function recordAudit(
  ctx: AuthzContext,
  node: orgNodeRepo.OrgNodeRow,
  personId: string,
  roleKey: string,
  withLogin: boolean,
): Promise<void> {
  return auditRepo.record({
    actorPersonId: ctx.personId,
    action: "add_member",
    targetType: "Person",
    targetId: personId,
    cityId: node.cityId,
    metadata: { roleKey, nodeId: node.id, withLogin },
  });
}
