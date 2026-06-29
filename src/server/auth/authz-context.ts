// Resolve the AuthzContext ONCE per request, memoized with React cache(). This is
// the single place authority is loaded from the DB; canActOn checks against it are
// then pure and free. tokenVersion is verified here (the read we already do) so a
// password change / deactivation forces re-auth without a session store (§12).

import { cache } from "react";
import type { AuthzContext } from "@/types/auth";
import { UnauthorizedError } from "@/server/errors";
import * as authzRepo from "@/server/repositories/authz-repo";
import { requireSession } from "./session";

export const getAuthzContext = cache(async (req?: Request): Promise<AuthzContext> => {
  const claims = await requireSession(req);

  // One query: liveness + grants. Revocation = the token's version must still
  // match the user's; the account must be active.
  const loaded = await authzRepo.loadForUser(claims.sub);
  if (!loaded || !loaded.isActive || loaded.tokenVersion !== claims.v) {
    throw new UnauthorizedError("Session no longer valid");
  }
  if (loaded.status !== "active") {
    throw new UnauthorizedError("Account is not active");
  }

  return { personId: loaded.personId, isSuperadmin: loaded.isSuperadmin, grants: loaded.grants };
});
