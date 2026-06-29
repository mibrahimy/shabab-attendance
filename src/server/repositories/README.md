# `repositories/` — data access

The **only** layer that imports the Prisma client (`@/server/db`). One repository per
aggregate (`orgNodeRepo`, `personRepo`, `attendanceRepo`, …).

Rules (ENGINEERING.md §5):

- **Every query is scoped and paginated** — no unbounded `findMany()`. Filter by
  `cityId` / subtree `path` prefix on every read.
- `select` / `include` only the fields needed — never over-fetch.
- Multi-row writes go in a `prisma.$transaction`.
- Return plain domain types (`@/types`), not raw Prisma payloads.

Real repositories arrive in **Phase 1** (identity & org spine). This file holds the
folder open so the layering exists from day one.
