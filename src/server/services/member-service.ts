// Direct-add of members (the trusted, no-approval path). Adding is gated by
// add_member scoped to the target node's subtree; students are profile-only,
// staff get a login with a generated temp password.

import { withTransaction } from "@/server/repositories/transaction";
import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import { hashPassword } from "@/server/auth/password";
import { generateTempPassword } from "@/lib/password-generate";
import { findRole, isProtectedRole } from "@/lib/default-roles";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as positionRepo from "@/server/repositories/position-repo";
import * as personRepo from "@/server/repositories/person-repo";
import * as userRepo from "@/server/repositories/user-repo";
import * as assignmentRepo from "@/server/repositories/assignment-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const ADD_MEMBER = "add_member";

type Segment = "junior" | "senior";

export async function listNodeMembers(
  ctx: AuthzContext,
  nodeId: string,
): Promise<assignmentRepo.NodeMember[]> {
  // Overlap the node load with the members query (two round trips → one wait);
  // authorize once both resolve, before returning anything.
  const [node, members] = await Promise.all([
    orgNodeRepo.findById(nodeId),
    assignmentRepo.listActiveByNode(nodeId),
  ]);
  if (!node) throw new NotFoundError("Node not found");
  requirePermission(ctx, ADD_MEMBER, { path: node.path, functionId: null });
  return members;
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
  await assertRoleAtLevel(node, role);

  const name = input.person.name.trim();
  if (!name) throw new ValidationError("Name is required");

  // Profile-only student: no User, CNIC optional. One transaction so a mid-way
  // failure can't leave an orphan Person with no assignment.
  if (role.isStudent) {
    const personId = await withTransaction(async (tx) => {
      const person = await personRepo.create(
        { name, segment: input.person.segment ?? null, status: "active", cityId: node.cityId },
        tx,
      );
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
    });
    await recordAudit(ctx, node, personId, role.canonicalKey, false);
    return { personId };
  }

  // Staff: needs a CNIC (login username) and a temp-password account.
  const cnic = input.person.cnic?.trim();
  if (!cnic) throw new ValidationError("CNIC is required for staff");
  if (await personRepo.findByCnic(cnic)) {
    throw new ValidationError("A person with this CNIC already exists", "CNIC_TAKEN");
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  let personId: string;
  try {
    personId = await withTransaction(
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
  } catch (err) {
    // A concurrent add with the same CNIC loses the unique-constraint race — the
    // pre-check above can't catch it. Surface the same friendly error.
    if (isUniqueViolation(err)) {
      throw new ValidationError("A person with this CNIC already exists", "CNIC_TAKEN");
    }
    throw err;
  }

  await recordAudit(ctx, node, personId, role.canonicalKey, true);
  return { personId, tempPassword };
}

// Prisma unique-constraint violation, duck-typed so the service stays Prisma-free.
function isUniqueViolation(err: unknown): boolean {
  return typeof err === "object" && err !== null && (err as { code?: string }).code === "P2002";
}

// System-managed roles (superadmin, city_admin) aren't removable/movable through
// the member endpoints — guards against locking a city out of its own management.
// They're provisioned by the seed / onboarding cascade, not these flows.
function assertNotProtected(roleKey: string): void {
  if (isProtectedRole(roleKey)) {
    throw new ValidationError("This role can't be removed or moved here");
  }
}

// Soft-remove: end the assignment, keep the Person + history. Gated by add_member
// at the assignment's node.
export async function removeMember(ctx: AuthzContext, assignmentId: string): Promise<void> {
  const a = await assignmentRepo.findActiveById(assignmentId);
  if (!a) throw new NotFoundError("Assignment not found");
  assertNotProtected(a.roleKey);
  const node = await orgNodeRepo.findById(a.orgNodeId);
  if (!node) throw new NotFoundError("Node not found");
  requirePermission(ctx, ADD_MEMBER, { path: node.path, functionId: null });

  await assignmentRepo.endAssignment(assignmentId);
  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "remove_member",
    targetType: "Person",
    targetId: a.personId,
    cityId: a.cityId,
    metadata: { assignmentId, nodeId: node.id },
  });
}

// Move a member to another node/role: end the old assignment + create a new one,
// preserving history. Requires add_member on BOTH the source and target subtrees.
export async function moveMember(
  ctx: AuthzContext,
  assignmentId: string,
  input: { targetNodeId: string; roleKey: string },
): Promise<{ personId: string }> {
  const a = await assignmentRepo.findActiveById(assignmentId);
  if (!a) throw new NotFoundError("Assignment not found");
  assertNotProtected(a.roleKey);

  const [source, target] = await Promise.all([
    orgNodeRepo.findById(a.orgNodeId),
    orgNodeRepo.findById(input.targetNodeId),
  ]);
  if (!source || !target) throw new NotFoundError("Node not found");
  requirePermission(ctx, ADD_MEMBER, { path: source.path, functionId: null });
  requirePermission(ctx, ADD_MEMBER, { path: target.path, functionId: null });
  if (!target.cityId) throw new ValidationError("Members attach below the city level");

  const role = findRole(input.roleKey);
  if (!role) throw new ValidationError("Unknown role");
  await assertRoleAtLevel(target, role);

  await withTransaction(
    async (tx) => {
      await assignmentRepo.endAssignment(assignmentId, tx);
      const position = await positionRepo.findOrCreateRolePosition(
        target.cityId!,
        role.canonicalKey,
        role.permissionKeys,
        tx,
      );
      await assignmentRepo.create(
        { personId: a.personId, positionId: position.id, orgNodeId: target.id, cityId: target.cityId },
        tx,
      );
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "move_member",
    targetType: "Person",
    targetId: a.personId,
    cityId: target.cityId,
    metadata: { assignmentId, from: source.id, to: target.id, roleKey: role.canonicalKey },
  });
  return { personId: a.personId };
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

// A role attaches at exactly one level (Student/Murabbi at a Class, Park Admin at a
// Park). Validates the target node is that level.
async function assertRoleAtLevel(
  node: orgNodeRepo.OrgNodeRow,
  role: { label: string; attachLevelKey: string },
): Promise<void> {
  if (!node.cityId) throw new ValidationError("Members attach below the city level");
  const levels = await nodeTypeRepo.listCityLevels(node.cityId);
  const nodeLevel = levels.find((l) => l.id === node.typeId);
  if (!nodeLevel || nodeLevel.key !== role.attachLevelKey) {
    throw new ValidationError(`${role.label} can't be placed at this level`);
  }
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
