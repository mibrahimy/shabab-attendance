// Student-intake surface (RSC · ROADMAP SI-2/SI-5). The launch-critical mobile
// path: the caller's OWN classes, each with its head murabbi and a direct "Add
// shabab" affordance — no org-tree navigation. Scoped in-process to the caller's
// add_member authority; a Forbidden/NotFound renders as a friendly panel (parallel
// to the reports page). An empty scope renders the list's own empty state.

import { getAuthzContext } from "@/server/auth/authz-context";
import * as intakeService from "@/server/services/intake-service";
import { ForbiddenError, NotFoundError } from "@/server/errors";
import { DEFAULT_ROLES } from "@/lib/default-roles";
import { IntakeList } from "@/components/intake/IntakeList";

export default async function IntakePage() {
  const ctx = await getAuthzContext();

  let classes: Awaited<ReturnType<typeof intakeService.listIntakeClasses>>;
  try {
    classes = await intakeService.listIntakeClasses(ctx);
  } catch (err) {
    if (err instanceof ForbiddenError || err instanceof NotFoundError) {
      return (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800">
          You don’t have access to student intake.
        </div>
      );
    }
    throw err;
  }

  // The student role(s) for the class level — passed to the mini-batch add flow.
  const studentRoles = DEFAULT_ROLES.filter((r) => r.isStudent);
  return <IntakeList classes={classes} studentRoles={studentRoles} />;
}
