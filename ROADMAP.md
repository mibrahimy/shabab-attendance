# Roadmap — next tasks (pick one at a time)

A prioritized backlog for continuing development on `feat/v2-multi-city-architecture`.
Companion to `DEVELOPMENT.md` (the phase plan), `ENGINEERING.md` (how we write code), and
`MIGRATION.md` (the one-time ETL).

**How to use:** work top-down within a section. Take the top unblocked task in **Now**, do it as
one focused change, keep it green, commit, tick it here, move on. Each task is self-contained
(why · scope · acceptance). Don't batch unrelated tasks into one commit.

**Guiding principles (apply to every task):**
- **UX first.** Simple, intuitive end-user flows — fewest steps, one obvious primary action, no
  redundant/confusing controls. Treat a flow check as part of "done." (Standing user directive.)
- **Stability.** Behaviour-preserving unless the task is the behaviour change; each task ends
  `tsc` + `eslint` + `vitest` green before commit.
- **Layering (`ENGINEERING.md` §2).** Imports point downward; only repos touch Prisma; contracts
  in `src/types`; components render, don't decide.
- Small commits, conventional messages, `Co-Authored-By: Claude Opus 4.8`. Public repo → no member
  PII in commits.

---

## Now — do next (ordered)

### N1 · Lock in the layering: boundary-guard test + doc  *(arch, small, low risk)*
**Why:** phases 1–2 of the refactor closed the frontend→server and Prisma-in-services breaches
(commit `4ee7920`); without a guard they'll silently regress.
**Scope:**
- Add `src/architecture-boundaries.test.ts` (vitest, in the style of `src/i18n/no-physical-css.test.ts`)
  asserting: (a) files with `"use client"` don't import `@/server/**` or Prisma; (b) `src/server/services/**`
  don't import `@/server/db`/`@prisma`/`prisma/generated`; (c) `src/lib/**` and `src/types/**` import no
  React/Prisma/`@/server`.
- Move the one misfiled hook `src/lib/offline/use-online.ts` → `src/hooks/use-online.ts`; update importers.
- Amend `ENGINEERING.md` §2 to explicitly bless "RSC/server-component pages may call a service directly"
  (and note `React.cache`/`next/headers` in `server/auth` are runtime, not UI).
**Acceptance:** the new test passes on the current tree; grep shows zero violations; tsc/eslint/vitest green.

### N2 · Icon set (enabler for the UX cleanup)  *(UX, small–med)*
**Why:** the app uses ~12 opaque unicode glyphs as buttons (`⌖ ⇄ ✕ ⤢ ▤ ⠿`), several destructive; the
UX review calls a small icon set the prerequisite for cleaning up the hierarchy surfaces.
**Scope:** a `src/components/ui/icons/` module of ~15 inline-SVG icons (plus, pencil, trash, move,
target/focus, grip, chevron, search, download, dots, person, team, close…), rendered with
`currentColor`, `aria-label`ed, logical-CSS/RTL-safe. No external dependency.
**Acceptance:** icons render inheriting button colour in light/dark; used in ≥1 real spot as proof.

### N3 · One shared `<Segmented>` + `event-status-styles.ts`  *(UX consistency, low–med)*
**Why:** the segmented-pill look is re-implemented in 4 places and the mark screen styles a *toggle* and
an *action* identically; event-status pills are redefined 4× with drift.
**Scope:** promote `CreateEventForm`'s local `Segmented` to `src/components/ui/Segmented` (with a
`Link`-rendering variant) and adopt it for hub scopes, hierarchy view-toggle, report periods. Extract
`src/components/attendance/event-status-styles.ts` (mirroring `status-styles.ts`) and use it in
`mark/page`, `HomeDashboard`, `PersonReportView`, `ReportView`. Give toggles vs. actions distinct shapes.
**Acceptance:** one Segmented source; one event-status-colour source; no visual regression.

### N4 · Hierarchy editor: one canonical action surface + real primary  *(UX, HIGH value, higher risk)*
**Why:** the single biggest confusion source — the same node exposes different actions from tree row
vs. chart box vs. detail pane (add-child has 3 paths; rename only via undiscoverable chart double-click;
delete invisible in tree). And the toolbar has no primary action.
**Scope:** make the **detail pane the canonical action surface** (add child, add member, rename, move,
delete, focus — all labelled `Button`s there). Remove the chart hover `＋`/`✕` and chart double-click-rename
duplicates. Keep drag (move) and the tree inline-add as deliberate secondary fast-paths. De-dupe person-row
actions to drag + detail-pane buttons (drop the cramped in-tree `⇄`/`✕`). Add a primary "＋ Add {level}" to
the toolbar. Use N2 icons for the remaining glyph buttons.
**Depends on:** N2 (icons), ideally done together with **L1** (decompose `HierarchyWorkspace`) so the
1,246-line file is rebuilt once — see L1.
**Acceptance:** every node action reachable from the detail pane; no capability differs by view; drag +
inline-add remain; a first-time admin sees an obvious "Add"; tsc/eslint/vitest green + a manual click-through.

### N5 · Cross-link Hierarchy ↔ Reports (node level)  *(UX, low–med)*
**Why:** an admin viewing a low-attendance class in the report can't jump to it in the hierarchy, and vice
versa — a dead-end between the two admin surfaces.
**Scope:** add a "View report" link on the hierarchy detail pane (→ `/reports/[cityId]/node/[nodeId]`) and a
"Open in hierarchy" link on the node report.
**Acceptance:** round-trip navigation works, scoped by `view_attendance`.

---

## Next — soon

### X1 · #103 Re-add the Shabab Friday Study Circle (Islamabad-wide event)  *(product, small)*
Re-create the recurring Islamabad-wide event from the dump attendee list. Verify roster resolves.

### X2 · Reports: level filter + discoverability  *(product/UX, med)*
"Show all classes / all parks" flatten filter on the report (`assembleBody` gains a level/flatten mode);
Reports entry on the mobile bottom bar; a report deep-link from the dashboard; period filter on the person
report. (Partially overlaps N5.)

### X3 · P3 — API + repo hardening  *(arch/scale, med)*
`events` GET `preview` branch → zod coercion (no inline param-shaping in the handler); zod query schemas on
the 3 search GETs; **bound the unbounded queries** — `listCompletedInCity`/`listCompletedUnderNode`
(aggregate in SQL or cap range+take), `listByPerson` (groupBy count + take only the trend rows),
`listInScope` upcoming (add `take`). Preserve report numbers (cover with tests).

### X4 · P4 — `hooks/` + `lib/api-client.ts` + remaining contract moves  *(arch, med)*
Typed `apiFetch` / `useMutation` / `useDebouncedFetch`; migrate the 9× mutation-wrapper and 3× typeahead
copies. Move the remaining re-declared client contracts to `src/types` (`HubEvent`/`ListedEvent`,
`Entry`/`RosterEntry`+`MarkerRoster`, `CityDashboard`/`WeekRate`, `PersonHit`/`NodeHit`).

### X5 · Route page CTAs through `<Button>`; resolve the magenta Save  *(UX consistency, low–med)*
Hand-rolled `bg-[#2f55ea]` CTAs and ad-hoc danger colours → the shared `Button` variants. Decide whether the
magenta `#c41f6a` Save is the documented "commit" accent or should become royal blue.

### X6 · Role-based default landing  *(UX, low)*
Pure markers (only `mark_attendance`) land on `/mark` instead of the dashboard — one fewer hop to the core job.

### X7 · Scripts hygiene  *(cleanup, low)*
Delete the 4 dead scripts (`migrate-session-levels.ts` — doesn't compile —, `migrate-restructure.ts`,
`build-attendance-report.ts`, `import-excel.ts`; remove the `tsconfig` exclude hack). Reorganise: `prisma/`
= schema+migrations+seed; new `scripts/` for ops (`create-superadmin`); `scripts/etl/` for the ETL +
`dump-data`; archive the one-shot migrations (`migrate-backfill-level-config`, `migrate-insert-zones`).

---

## Later — larger / staged

### L1 · Decompose the fat components  *(arch, HIGH risk — pair with N4)*
`HierarchyWorkspace` (1,246 lines) → hooks (`useHierarchyTree`, `useNodeMembers`, `useHierarchyMutations`,
`useTreeDrag`, `useChartViewport`) + presentational `TreeView`/`OrgChart`/`NodeDetailPane`/`HierarchyToolbar`
+ a CSS module. Same treatment for the oversized `mark/[eventId]` page, `ReportView`, `LevelsEditor`,
`HomeDashboard`, `CreateEventForm`, `mark/page`. **Best done as the vehicle for N4** so the file is rebuilt
once. Behaviour-preserving; verify with a full click-through.

### L2 · Low-severity report findings  *(correctness polish, low)*
Reconcile the per-person rate (`ratesByPersonUnderNode` counts all events in range) with the "By location"
table (completed only); fix the cosmetic node-name shown for a multi-assignment person in node-scoped search.

### L3 · Urdu / RTL fill  *(i18n, med — Phase 5-adjacent)*
Fill the empty `ur/*` catalogs; full RTL on the public surfaces first (`/apply`, WhatsApp), admin
incrementally. Foundation (logical CSS) is already in place.

### L4 · Cross-cutting hardening (before real launch)  *(Phase 7)*
- **Security:** minors' PII posture — encryption at rest, retention/deletion policy, PII gated behind
  permissions (see `future-phases-rnd`: Neon AES + app-level CNIC blind-index); rate-limit/CAPTCHA on future
  public forms.
- **Observability:** structured logging + error tracking (Sentry); alerting on the outbox/cron/sync machinery.
- **Ops:** automated DB backups + tested restore; a real staging env; CI gating lint/tsc/tests on PRs.
- **API contract:** `api/v1` prefix + OpenAPI + sync idempotency key (the "change now" items) before the
  native client consumes it.

### L5 · Phases 5–8 (per `DEVELOPMENT.md`)
Public intake + WhatsApp (5) → assessments (6) → hardening/security/advanced reporting (7) → native apps (8).

---

## Ship checklist (do around the next deploy)
- [ ] Set a production `JWT_SECRET` on Railway (**user action** — app refuses to boot without it).
- [ ] Remove the stray "Test" event from the live DB.
- [ ] Live browser QA pass: hierarchy drag/minimap; team-event marking; new-city (empty) dashboard.
- [ ] Confirm the `rosterMode` migration is applied on prod (done) and the Railway deploy is current.

---

*Last updated: 2026-07-13. Keep this file current — tick/remove tasks as they land, add new ones on top of
the right section.*
