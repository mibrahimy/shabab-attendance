// Resolve the AuthzContext ONCE per request, memoized with React cache(). This is
// the single place authority is loaded from the DB; canActOn checks against it are
// then pure and free. tokenVersion is verified here (the read we already do) so a
// password change / deactivation forces re-auth without a session store (§12).

import { cache } from "react";
import type { AuthzContext } from "@/types/auth";
import { UnauthorizedError } from "@/server/errors";
import * as userRepo from "@/server/repositories/user-repo";
import * as authzRepo from "@/server/repositories/authz-repo";
import { requireSession } from "./session";

export const getAuthzContext = cache(async (req?: Request): Promise<AuthzContext> => {
  const claims = await requireSession(req);

  // Revocation + liveness check: the token's version must still match the user's,
  // and the account must be active.
  const user = await userRepo.findById(claims.sub);
  if (!user || !user.isActive || user.tokenVersion !== claims.v) {
    throw new UnauthorizedError("Session no longer valid");
  }
  if (user.person.status !== "active") {
    throw new UnauthorizedError("Account is not active");
  }

  const { grants, isSuperadmin } = await authzRepo.loadAuthz(claims.pid);

  return { personId: claims.pid, isSuperadmin, grants };
});
