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

## Shipped — autonomous session (2026-07-14)

Committed + pushed on `feat/v2-multi-city-architecture`, all green (tsc/eslint/vitest incl. the
boundary + RTL guards), no prod migrations:
- **N1** — layer-boundary guard test + `use-online` → `src/hooks/` (`c766a15`)
- **SI-1** — mini-batch quick-add for shabab (modal stays open, Enter, "Added N") (`e212fa0`)
- **N2** — inline-SVG icon set (`src/components/ui/icons`) + icons on the detail-pane node actions (`aba214f`)
- **N3** — shared `<Segmented>` atom (4 sites) + `event-status-styles` module (`d7aad15`)
- **N5** — Hierarchy → node-report cross-link (`5dc564a`)
- **SI-2 + SI-5** — mobile-first `/intake` surface: a park admin's own classes, each named by its
  murabbi, with mini-batch "Add shabab"; authz-scoped to `add_member` (`d74438e`)

**Next up:** SI-3 (guardian PII fields — needs a schema migration; write it, hold the prod apply),
SI-4 (staff-login label/verify), SI-6 (flow review), SI-7 (intake authz tests), SI-8 (PII
read-gating). **N4** (hierarchy → one canonical action surface) is the biggest remaining UX win but is
a user-facing restructure — best done as a *reviewed* pass, not unsupervised.

---

## Launch-critical — student intake & onboarding  *(this gates launch)*

Launch requires a **zone lead / park admin** to onboard a shabab end-to-end so student
attendance can be taken: **add the person → (the staff user who marks them) → interview eval →
assign under a murabbi.** Good news from the planning pass: this chain is **~90% already built** —
a student added at a `class` node *is* placed under that class's murabbi (add = assignment, one
action), and staff (murabbi/park-admin) already get one-time logins. Gaps are intake UX (mobile +
fast repeat-add), guardian PII fields + gating, and a minimal interview eval.

**Decisions (baked in):** students stay **profile-only, no login** (the "user" to create is the
*staff* who mark them); interview eval is a **fixed-field `InterviewEval` model**, not the Phase-6
FormTemplate; **no approval gate** on direct add (add-active); **individual + stay-open mini-batch**,
CSV import post-launch; the eval is **optional/skippable** — never blocks intake.

**Must-ship for launch (ordered):**
- **SI-1 · Mini-batch quick-add** — `AddMemberModal` stays open after a student add, clears+refocuses
  name, keeps the class/role, shows "Added N". 10 shabab = 10 name+Enter. *(S, no server change.)*
- **SI-2 · Mobile intake surface** — new `/intake` RSC scoped to the actor's `add_member` subtree:
  lists *their* classes, each "Add shabab to [murabbi]'s class". ≤2 taps from home; reuses the members
  endpoint. *(M)*
- **SI-3 · Guardian/contact fields** — nullable `guardianName`/`guardianPhone` (± `dob`) on `Person`
  (+ migration), threaded through repo/service/zod/form (optional for students); PII-gated on read (SI-8). *(M)*
- **SI-4 · Confirm staff-login = the "create user" step** — verify murabbi/park-admin add yields a
  one-time credential; students never do; label "Student = no login". *(S, no mechanism change.)*
- **SI-5 · Show the murabbi in the intake UX** — class header + add affordance name the class's head
  murabbi (existing head query). *(S)*
- **SI-6 · End-to-end flow review** — walk the minimized park-admin path on a phone; fix friction;
  confirm skipping the eval never blocks. *(S)*
- **SI-7 · Intake authz tests** — park admin can't add outside their park; students never get a `User`;
  direct-add is `active`. *(S)*
- **SI-8 · PII read-gating** — CNIC/phone/guardian/eval-notes omitted from list/detail unless the viewer
  holds the permission in scope; log the encryption-at-rest + retention follow-up. *(M)*

**Fast-follow (right after launch):**
- **SI-9 · `InterviewEval` model + repo + service** — one eval/person (recommendation enum + 3×1–5
  scores + notes + interviewer + date), `add_member`-gated, audited. *(M)*
- **SI-10 · Interview-eval capture UI** — `InterviewEvalModal`, optional chip in the add flow +
  member-row action; `POST/GET /api/persons/[id]/interview-eval`. *(M)*
- **SI-11 · CSV/Excel bulk import** · **SI-12 · per-student "Provision login"** · **SI-13 · verify
  class→class transfer on mobile**.

*The chain is authorized today (park admin + zone lead hold `add_member` in their subtree). Critical
files: `member-service.ts`, `AddMemberModal.tsx`, `default-roles.ts`, `prisma/v2/schema.prisma`,
`HierarchyWorkspace.tsx`.*

---

## Now — UX + arch (interleave with launch-critical above)

### ✅ N1 · Lock in the layering: boundary-guard test + doc — DONE (`c766a15`)
Added `src/architecture-boundaries.test.ts` (3 rules, green) + moved `use-online` → `src/hooks/`.
*(The §2 doc amendment is applied locally but held out of the commit — `ENGINEERING.md` also carries
separate uncommitted native/multi-client notes.)*

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
