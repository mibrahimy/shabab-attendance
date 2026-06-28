# Engineering Guidelines

The conventions for the **v2 multi-city architecture** rebuild. The goal is code that is **clean, readable, and maintainable**, with a hard separation between frontend and backend. Read this before writing code; treat the rules as defaults, and call out in review when a rule is deliberately broken.

> Architecture/data-model decisions live in `target-architecture.html`. This file is about *how we write the code*, not *what the model is*.

---

## 1. Tech stack (what conventions are grounded in)

| Area | Choice |
|---|---|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript 5 (strict) |
| Data | Prisma 6 → Neon Postgres (`DATABASE_URL_V2`) |
| Styling | Tailwind v4 |
| Auth | `jose` (JWT), `bcryptjs` (hashing) |
| Lint | ESLint 9 (`eslint-config-next`) |
| E2E tests | Playwright |
| Path alias | `@/*` → `src/*` |

To add (recommended, not yet installed): **zod** (input validation), **vitest** (unit/service tests), **prettier** (formatting).

---

## 2. Architecture — the layers and the one rule that matters

Code is organized in layers, and **imports only ever point downward**. This is the single most important rule in this document.

```
  src/app/  (pages) · src/components/ · src/hooks/      ← FRONTEND  (React)
        │   talks to backend ONLY via fetch() to app/api or a server action
        ▼
  src/app/api/**/route.ts                               ← API BOUNDARY (thin handlers)
        │   calls
        ▼
  src/server/services/**                                ← BACKEND: business logic (no React)
        │   calls
        ▼
  src/server/repositories/**                            ← DATA ACCESS: the ONLY Prisma importers
        │
        ▼
        Prisma → Neon (DATABASE_URL_V2)

  src/lib/ (pure utils) · src/types/ (contracts)        ← SHARED: importable by any layer, depends on none
```

**Dependency rules (enforced in review):**
- **Frontend** (`app/`, `components/`, `hooks/`) **must not** import Prisma, `src/server/**`, or any DB code. It reaches the backend only through the API boundary (or a thin server action).
- **Backend** (`src/server/**`) **must not** import React, Next UI, `components/`, or anything in `app/` except being *called by* route handlers.
- **Only `repositories/` import `@prisma/client`.** Services never touch Prisma directly; components never touch Prisma at all.
- **`lib/` and `types/` are leaves** — pure, no React, no Prisma, importable everywhere.

If you need an upward import, the design is wrong — stop and move the code.

---

## 3. Folder structure

```
src/
  app/                      # FRONTEND — routing + pages only
    (dashboard)/...           # route segments → thin pages
    api/                      # ← ALL APIs live here (the separate API folder)
      <resource>/route.ts     # thin handlers: validate → call service → respond
  components/               # FRONTEND — React UI
    ui/                       # generic, presentational (Button, Modal, Card…)
    <feature>/                # feature components (team/, events/…)
  hooks/                    # FRONTEND — client-side hooks
  server/                   # BACKEND — no React, ever
    services/                 # business logic / use-cases (orchestration)
    repositories/             # data access — only layer importing Prisma
    auth/                     # session + permission resolution
    db.ts                     # Prisma client (v2)
  lib/                      # SHARED — pure utilities (no React, no Prisma)
  types/                    # SHARED — domain types + API request/response contracts
```

- A "feature" (team, events, attendance, parks…) appears as a slice in **each** layer (a page, components, a service, a repository) rather than one giant module. Keep the slices thin.

---

## 4. The API layer (`src/app/api/`)

All HTTP endpoints live here, and **handlers are thin**. A route handler does exactly four things:

1. **Authenticate** — resolve the session (`server/auth`).
2. **Validate** input (params, body, query) — reject bad input early (zod).
3. **Call one service** function — the handler contains *no* business logic and *no* Prisma.
4. **Format** the response — consistent success/error shape, correct status code.

```ts
// src/app/api/events/route.ts  — illustrative shape
export async function GET(req: NextRequest) {
  const session = await requireSession(req);          // auth
  const query = eventListQuery.parse(...);            // validate
  const events = await eventService.list(session, query); // delegate
  return Response.json({ data: events });             // format
}
```

- **One resource per folder**; HTTP verbs map to `GET/POST/PATCH/DELETE` exports.
- **Never** put a query or business rule in a route handler. If a handler is longer than ~20 lines, logic has leaked — push it into a service.
- Consistent envelopes: success `{ data }`, error `{ error: { code, message } }`.

> Server actions are allowed for simple form mutations, but they follow the **same** rule: thin, in `server/`, delegating to a service. Don't split logic between actions and services.

---

## 5. Backend conventions

**Services (`server/services/`)** — the business logic.
- A service function = one use-case (`eventService.create`, `attendanceService.mark`). Named by intent.
- **Permissions are enforced here, in one place** — never in the UI, never in the route handler beyond auth. Use the single permission rule (`canActOn(person, permission, target)`): act iff `target ∈ subtree(anchor)` AND function matches. See `target-architecture.html`.
- Services orchestrate repositories; they don't write SQL/Prisma themselves.
- Pure where possible — pass data in, return data out; keep side effects explicit.

**Repositories (`server/repositories/`)** — the only Prisma code.
- One repository per aggregate (`orgNodeRepo`, `personRepo`, `attendanceRepo`).
- **Every query is scoped.** No unbounded `findMany()` — always filter by `cityId`/subtree and **paginate** lists. (We have shipped an unbounded-query bug before; treat it as a hard rule.)
- `select`/`include` only the fields you need — never over-fetch.
- Multi-row writes go in a `prisma.$transaction`.
- Repositories return plain domain types (`src/types`), not raw Prisma payloads leaking into the frontend.

**Tenancy & scoping (cross-cutting).**
- `cityId`/`countryId` are denormalized scoping keys — filter by them on every read.
- Cross-tenant access (POC oversight) is *explicit* — `WHERE cityId IN (...assigned)`, never accidental.

---

## 6. Frontend conventions

- **Server Components by default.** Add `"use client"` only when you need state, effects, or browser APIs — and push it as far down the tree as possible.
- **Components render; they don't decide.** No business rules, no permission logic, no data shaping in components — that belongs in the backend. A component receives already-decided data and displays it.
- **`components/ui/`** = generic and reusable (no feature knowledge). **`components/<feature>/`** = feature-specific.
- Keep components small and single-purpose. If a component file passes ~200 lines or mixes fetching + heavy layout, split it.
- Data fetching: Server Components fetch via services on the server; Client Components fetch via the `app/api` endpoints. Never import a repository or Prisma into a component.
- Styling: Tailwind utilities; use `clsx` for conditional classes. Extract a UI component before copy-pasting class strings a third time.

---

## 7. Shared: types, validation, errors

- **`src/types/`** holds domain types and **API contracts** (request/response shapes) shared by frontend and backend — one source of truth, no drift.
- **Validate all external input at the boundary** (route handlers, server actions) with zod. Trust nothing from the client.
- **Typed errors**: services throw a small set of known errors (`NotFoundError`, `ForbiddenError`, `ValidationError`); the API layer maps them to status codes + the `{ error }` envelope. Never leak a raw Prisma error or stack trace to the client.

---

## 8. TypeScript & code style

- **`strict` on; no `any`.** Use `unknown` + narrowing if a type is genuinely open.
- **Explicit return types on exported functions.** Inference is fine for locals.
- Prefer **`type`** for shapes/unions; `interface` only when extension/declaration-merging is needed.
- Name by intent: `markAttendance`, not `handleData`. Booleans read as questions (`isActive`, `canManageTeam`).
- **Files**: components `PascalCase.tsx`; everything else `kebab-case.ts`. One primary export per file.
- Small functions, early returns over nested `if`. Comment **why**, not **what** — the code says what.
- **DRY, but not prematurely.** Don't abstract until the third occurrence; a little duplication beats the wrong abstraction.
- No dead code, no commented-out blocks committed, no `console.log` left in (use a logger or remove).

---

## 9. Testing

- **Services and repositories** get unit/integration tests (vitest) — they hold the logic, so they hold the tests. Permission and scoping rules **must** be tested.
- **Critical user flows** get Playwright e2e tests (login, mark attendance, the permission boundaries).
- A bug fix ships with a test that fails without the fix.
- Tests run against a disposable DB, never the live or v2 production database.

---

## 10. Tooling

- `npm run lint` must pass (zero warnings) before a PR.
- Recommend adding **prettier** for formatting so diffs stay about logic, not whitespace.
- `tsc --noEmit` (type check) is part of "done."

---

## 11. Git & PRs

- Branch from `dev`: `feat/...`, `fix/...`, `chore/...`.
- Small, focused commits with imperative messages ("add org-node repository", not "changes").
- A PR does **one** thing and includes: what changed, why, how it was tested.
- Never commit secrets; `.env*` is gitignored and stays that way.

---

## 12. Request lifecycle & auth

Everything funnels through **services** — the single choke point for logic and permissions. Reads and mutations differ only in how they *reach* a service:

- **Reads (a page):** an `async` Server Component verifies the session and calls a service **in-process**. Do **not** make an RSC HTTP-hop back to our own `app/api` — the API layer is for client fetches and external callers, not for the server to call itself.
- **Mutations:** a Client Component or server action hits a thin `app/api` handler (`requireSession → zod validate → call service`).

**Authentication — the token carries *identity only*.**
- Login (`POST /api/auth/login`, `{ cnic | email, password }`) verifies bcrypt + `Person.status = active`, then issues a `jose` JWT in an **httpOnly, Secure, SameSite=Lax** cookie. Legacy accounts resolve by **email or CNIC** (§ MIGRATION); new accounts use CNIC.
- Claims are minimal: `{ sub: userId, pid: personId, cid: homeCityId, mcp: mustChangePassword, v: tokenVersion }`. **Never put permissions/assignments in the token** — they change (stale authority = security bug) and bloat it.
- **Session = one short-lived JWT, ~8h, sliding** — re-issued on any authenticated request past ~half its life. No refresh-token pair, no server-side session store.
- **Middleware does authentication only**: `jose` verifies signature + expiry on the edge, redirects unauthenticated users to login, and gates `mustChangePassword`. **No DB and no authorization in middleware.**

**Authorization — resolve the subtree context once per request.**
- On first need, one query (active `Assignment`s ⋈ `PositionPermission`s ⋈ anchor `OrgNode`) builds an `AuthzContext`, memoized with React `cache()`:
  ```ts
  type AuthzContext = {
    personId: string;
    isSuperadmin: boolean;          // a grant anchored at the global root
    grants: Array<{ permission: string; anchorPath: string; functionId: string | null; cityId: string | null }>;
  };
  ```
- Every check is then **pure, in-memory, zero-DB**:
  ```ts
  const canActOn = (ctx, perm, target /* {path, functionId} */) =>
    ctx.grants.some(g =>
      g.permission === perm &&
      target.path.startsWith(g.anchorPath) &&            // subtree = path prefix
      (g.functionId === null || g.functionId === target.functionId));
  ```
- Multi-position = union of grants (free); POC = a grant anchored at another city's root; superadmin = a grant at the global-root path. Store materialized paths with a **trailing delimiter** (`/…/parkX/`) so a prefix can't match `parkX2`; index with `text_pattern_ops`.
- **Two shapes, one rule:** single-target mutations call `canActOn` in the service (throw `ForbiddenError` → 403); **list scoping lives in the repository SQL** (`WHERE path LIKE anchor || '%'` OR'd across the actor's anchors + function filter) — never fetch-then-filter in JS.
- **Revocation without a store:** the `tokenVersion` claim is checked during the authz-context load (a read we already do); bump `User.tokenVersion` on password change / deactivation to force re-auth.

Net cost of the permission system per request = one small indexed query + in-memory prefix checks. Nothing per-target, nothing recursive.

---

## 13. Background jobs & integrations

Serverless or not, we avoid long-running workers and in-memory queues — reliability rides on **two Postgres-backed patterns**.

**Outbox for reactive side-effects (e.g. WhatsApp on submit/approval).** In the **same transaction** as the business write, insert a `NotificationOutbox` row (`type · payload · status(pending|sent|failed) · attempts · nextAttemptAt · dedupeKey UNIQUE · providerMessageId`). A scheduled `outbox-drain` job sends pending-due rows, marks `sent` / backs off / dead-letters past max attempts. This makes the send **atomic with the write** and keeps user requests fast — never send inline (a crash or API hiccup loses or duplicates messages).

**Scheduled jobs** run as an **in-process `node-cron`** in the single Railway service (§15), each guarded against double-fire by **idempotency + a Postgres advisory lock**:
- `evaluations-due` (daily): create the next-cycle `Evaluation{status:due}` per active student when `now ≥ lastEval/enrollment + 4 weeks`. Idempotent via unique `(personId, cycleNo)`.
- `outbox-drain` (~1–2 min): the sender above.

Keep the equivalent `/api/cron/*` routes as **secret-protected, manually-callable** endpoints for testing/admin re-trigger — just not the primary trigger.

**Integrations are quarantined.** The only file that knows an external API's HTTP shape lives in `server/integrations/` (e.g. `whatsapp-client.ts` over the Meta Cloud API — template messages, System-User token, E.164 phones). Business logic (which template, opt-out, enqueue) is in `server/services/notification-service.ts`. The inbound webhook (`/api/webhooks/whatsapp`) verifies `X-Hub-Signature-256`, responds **200 fast**, then records delivery status (by `providerMessageId`) and handles `STOP` opt-out. Swapping a provider touches one file.

---

## 14. Offline & PWA

**Only the attendance hot path is offline** (a murabbi marking ~20 students in a poor-signal park). Everything else — hierarchy, approvals, onboarding, forms, reports — is **online-only**. Offline is **v1 scope**, designed in from the start, not retrofitted.

- **Local-first attendance:** while online (login / app-open / focus) prefetch today's events + the marker's slice rosters + the app shell into **IndexedDB** (via `idb`/Dexie) and a **Workbox** service worker. Offline, the UI reads from IndexedDB and writes marks to a local **outbox**, optimistically, tagged `{ markedById, clientUpdatedAt }`.
- **Sync** drains the outbox on reconnect / app-open / a manual "Sync now" button — **foreground sync, not the Background Sync API** (unreliable on iOS Safari, our key constraint). Request persistent storage to resist eviction.
- **Server impact is minimal:** the mark endpoint is an **idempotent upsert** `(eventId, personId)` with **last-write-wins by `clientUpdatedAt`**. Safe because collaborative slices are disjoint, so same-cell conflicts are near-impossible.
- The outbox is **keyed to `personId`** so a different user on the same device can't sync under the wrong identity. Surface a "last synced N min ago" + pending-count badge.
- **Testing:** offline is a first-class Playwright target (offline browser context).

---

## 15. Deployment & runtime

- **Host: Railway** — a persistent container running the app as a normal long-lived Node server (`next start`), chosen on cost. **One always-on service** = the Next.js app + the in-process `node-cron` scheduler (§13). One service, one bill.
- **Database: Neon now → Railway Postgres later.** Design **host-agnostic**: standard Prisma Postgres connector over a normal connection string, **no Neon-proprietary driver/features** (no `@neondatabase/serverless`). The eventual move is then `pg_dump`/`pg_restore` + swap `DATABASE_URL_V2` + redeploy — a lift-and-shift window, not a code change. Co-locate regions.
- **Connections:** a bounded Prisma pool in the long-lived process (no serverless connection-storm; the Neon pooler is optional).
- **Env separation:** `DATABASE_URL` = the untouched **live** DB (read-only, for dumps); `DATABASE_URL_V2` = the v2 DB. Secrets (Meta token, `CRON_SECRET`, JWT secret) in env only; never committed.

---

## 16. Definition of Done

- [ ] Respects the layer/dependency rules (§2) — no upward or cross-boundary imports.
- [ ] Business logic & permission checks in services, not UI or route handlers.
- [ ] All queries scoped + paginated; only repositories touch Prisma.
- [ ] Input validated at the boundary; errors typed and mapped.
- [ ] Types in `src/types`; no `any`; explicit exported return types.
- [ ] Tests for logic/permissions; lint + type-check pass.
- [ ] Auth in middleware only; authz via `AuthzContext` in services; list scoping in repo SQL (§12).
- [ ] Side-effects (notifications) go through the outbox in-tx; integrations isolated in `server/integrations/` (§13).
- [ ] Attendance writes are idempotent upserts safe for offline replay (§14); no Neon-proprietary DB calls (§15).
- [ ] No secrets, no dead code, no stray logs.
