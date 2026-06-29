// Org-structure use-cases: list the country/city tree and run the onboarding
// cascade (superadmin creates Country → City → inline City Admin). Permission is
// enforced here via canActOn against the parent node's path: only a grant that
// prefixes a Country/City parent (i.e. the global-root superadmin grant) passes,
// so these are effectively superadmin-only without a special-case check.

import { prisma } from "@/server/db";
import type { AuthzContext } from "@/types/auth";
import { NotFoundError, ValidationError } from "@/server/errors";
import { requirePermission } from "@/server/auth/can-act-on";
import { hashPassword } from "@/server/auth/password";
import { generateTempPassword } from "@/lib/password-generate";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as positionRepo from "@/server/repositories/position-repo";
import * as personRepo from "@/server/repositories/person-repo";
import * as userRepo from "@/server/repositories/user-repo";
import * as assignmentRepo from "@/server/repositories/assignment-repo";
import * as auditRepo from "@/server/repositories/audit-repo";

const MANAGE = "manage_hierarchy";

async function getGlobalRoot(): Promise<orgNodeRepo.OrgNodeRow> {
  const [root] = await orgNodeRepo.listRoots();
  if (!root) throw new NotFoundError("Global root not found — run the seed");
  return root;
}

export async function listOrg(ctx: AuthzContext): Promise<orgNodeRepo.CountryWithCities[]> {
  const root = await getGlobalRoot();
  requirePermission(ctx, MANAGE, { path: root.path, functionId: null });
  return orgNodeRepo.listCountriesWithCities();
}

export async function createCountry(
  ctx: AuthzContext,
  input: { name: string },
): Promise<orgNodeRepo.OrgNodeRow> {
  const name = input.name.trim();
  if (!name) throw new ValidationError("Country name is required");

  const root = await getGlobalRoot();
  requirePermission(ctx, MANAGE, { path: root.path, functionId: null });

  const type = await nodeTypeRepo.findNationalByCanonicalKey("country");
  if (!type) throw new NotFoundError("Country node type not found — run the seed");

  const country = await orgNodeRepo.createChild({
    parent: root,
    typeId: type.id,
    name,
    asCountry: true,
  });

  await auditRepo.record({
    actorPersonId: ctx.personId,
    action: "create_country",
    targetType: "OrgNode",
    targetId: country.id,
    metadata: { name },
  });

  return country;
}

export type CreateCityResult = {
  city: orgNodeRepo.OrgNodeRow;
  admin: { personId: string; userId: string; cnic: string; tempPassword: string };
};

export async function createCity(
  ctx: AuthzContext,
  input: {
    countryId: string;
    name: string;
    admin: { name: string; cnic: string; phone?: string | null };
  },
): Promise<CreateCityResult> {
  const name = input.name.trim();
  const adminName = input.admin.name.trim();
  const cnic = input.admin.cnic.trim();
  if (!name) throw new ValidationError("City name is required");
  if (!adminName) throw new ValidationError("City admin name is required");
  if (!cnic) throw new ValidationError("City admin CNIC is required");

  const country = await orgNodeRepo.findById(input.countryId);
  if (!country) throw new NotFoundError("Country not found");
  requirePermission(ctx, MANAGE, { path: country.path, functionId: null });

  // Reject a duplicate CNIC up-front (clearer than a Prisma unique violation).
  if (await personRepo.findByCnic(cnic)) {
    throw new ValidationError("A person with this CNIC already exists", "CNIC_TAKEN");
  }

  const cityType = await nodeTypeRepo.findNationalByCanonicalKey("city");
  if (!cityType) throw new NotFoundError("City node type not found — run the seed");

  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);

  // Whole cascade is atomic: a city must never exist without its admin.
  const result = await prisma.$transaction(async (tx) => {
    const city = await orgNodeRepo.createChild(
      { parent: country, typeId: cityType.id, name, asCity: true },
      tx,
    );
    const position = await positionRepo.findOrCreateCityAdminPosition(city.id, tx);
    const person = await personRepo.create(
      { name: adminName, cnic, phone: input.admin.phone ?? null, status: "active", cityId: city.id },
      tx,
    );
    const user = await userRepo.create(
      { personId: person.id, passwordHash, mustChangePassword: true },
      tx,
    );
    await assignmentRepo.create(
      { personId: person.id, positionId: position.id, orgNodeId: city.id, cityId: city.id },
      tx,
    );
    await auditRepo.record(
      {
        actorPersonId: ctx.personId,
        action: "create_city",
        targetType: "OrgNode",
        targetId: city.id,
        cityId: city.id,
        metadata: { name, adminPersonId: person.id },
      },
      tx,
    );
    return { city, personId: person.id, userId: user.id };
  }, {
    // Several sequential writes over a remote DB — give it headroom beyond
    // Prisma's 5s default so provisioning isn't flaky on higher-latency links.
    maxWait: 10_000,
    timeout: 20_000,
  });

  return {
    city: result.city,
    admin: { personId: result.personId, userId: result.userId, cnic, tempPassword },
  };
}
