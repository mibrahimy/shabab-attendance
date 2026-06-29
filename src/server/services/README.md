# `services/` — business logic

Use-cases / orchestration (`eventService.create`, `attendanceService.mark`). No React,
no Prisma — services call **repositories**.

Rules (ENGINEERING.md §5):

- **Permissions are enforced here, in one place** — never in the UI or route handler
  (beyond auth). Use the single rule `canActOn(ctx, permission, target)`: act iff
  `target ∈ subtree(anchor)` AND the function matches.
- Pure where possible — data in, data out; side effects explicit.

Real services arrive in **Phase 1**. This file holds the folder open.
