# Development Plan — v2

How we build the multi-city v2 app. Companion to `target-architecture.html` (the model), `v2-flows.html` (the flows), `ENGINEERING.md` (how we write code), and `MIGRATION.md` (the one-time ETL). **Status: Phases 0–4 built + hardened + redesigned; real Islamabad data migrated; plus dynamic per-city hierarchy, team attendance at every level, an interactive tree/org-chart editor, and reporting drill-down (see Status below).**

---

## Sequencing principles

- **Greenfield-first.** Build the new multi-city app as a fresh build; the migration of the existing Murabbi-Training data is a *later import* (Phase 4), not a prerequisite. We prove the new architecture on its own terms first.
- **Each phase ships working software** and depends on the one before it — no big-bang integration.
- **Attendance is the core**, and it's **offline-first from day one** (not retrofitted) — see `ENGINEERING.md` §14.
- **v1 scope discipline:** attendance is the product; intake/WhatsApp and assessments are real but *later* phases, not MVP.
- **API-first / multi-client.** A future native iOS/Android app is on the roadmap, so the backend is a **versioned, client-agnostic API** (web + native share it) from day one — bearer-or-cookie auth, an OpenAPI contract, and one sync protocol for both. The PWA proves the API the native app will later consume; native is additive, not a rework.

---

## Phases

| # | Phase | Goal / key deliverables | Exit criteria |
|---|---|---|---|
| **0** | **Foundations** | v2 Prisma schema (`DATABASE_URL_V2`); layer-cake folder skeleton; CI (lint/typecheck/test); Railway deploy pipeline + **staging env**; `seed` script (global root + superadmin) | empty app deploys to staging; lint/`tsc`/CI green; login as seeded superadmin |
| **1** | **Identity & org spine + auth** | `OrgNode` (materialized path) · `Person`/`User`/`Assignment` · `Position`/`Permission`; `AuthzContext` + `canActOn`; login + ~8h sliding JWT + middleware | permission rule unit-tested; assignment-scoped allow/deny proven |
| **2** | **Onboarding & hierarchy** | superadmin → country/city + city admin inline; hierarchy builder page; direct-add members; **teams per level** (see below); approvals queue; **audit log** introduced here | a city admin builds a tree and places people, fully scoped; every node shows its team |
| **3** | **Attendance (offline-first)** | `Event` + roster-by-path; slice marking; mobile UI + PWA/Workbox + IndexedDB outbox + sync | a murabbi marks ~20 students offline and it syncs cleanly |
| **4** | **ETL migration** | run Murabbi-Training data → v2 (per `MIGRATION.md`); resolve the review report | counts reconcile; real Islamabad data live; spot checks pass |
| **5** | **Public intake + WhatsApp** | `/register/team` + `/apply`; outbox + Meta Cloud API client + webhook; **rate-limit/CAPTCHA on public forms** | apply → pending → approve → enrolled, with WhatsApp confirmations; abuse-protected |
| **6** | **Assessments** | configurable `FormTemplate` engine; interview; 4-week evaluations + `node-cron`; progress view | city admin edits questions; evals fill; progress trend renders |
| **7** | **Hardening & launch** | reporting/analytics; POC cross-city; perf + load test; security review; launch checklist | launch checklist green |
| **8** | **Native mobile apps** *(future)* | iOS + Android consuming the **same versioned API**; OS **background sync** (`WorkManager`/`BGTaskScheduler`) on the shared sync contract; bearer-token auth | a native app marks + background-syncs against the existing backend, no API rework |

> **First shippable (MVP) = Phases 0–3**: a working multi-city, offline-capable attendance app on the v2 architecture (seed data). Migration (4) then brings real data; 5–7 extend.

### Teams per level (Phase 2)

Every org node has a **team**, and a team is **derived, not hand-maintained**: `team(node) = the node's own head + the heads of its direct children`. Assign someone as e.g. a Sector Lead under a zone and they automatically appear on that zone's team — there is no separate team list to curate. Teams are **per-node** (each Park has its own team).

Each level has a single **head position**:

| Level | Head | Team = head + children's heads |
|---|---|---|
| global-root | **Operations Lead** *(= the `superadmin`)* | Ops Lead + Country Leads |
| country | **Country Lead** *(new)* | Country Lead + City Leads |
| city | **City Lead** *(= the `city_admin`)* | City Lead + Zone Leads |
| zone | **Zone Lead** *(new)* | Zone Lead + Sector Leads |
| sector | **Sector Lead** *(new)* | Sector Lead + Park Admins |
| park | **Park Admin** *(exists)* | Park Admin + Murabbis |
| class | **Murabbi** *(exists)* | Murabbi (students are the attendance target, not team) |

- The **Operations Lead is the `superadmin`** and the **City Lead is the `city_admin`** — the same provisioned person doubles as their level's head, not a separate role. So only **three new head positions** are needed: `country_lead`, `zone_lead`, `sector_lead`.
- This closes today's gap: only `park_admin`/`murabbi` are level-attachable, so Zone/Sector/Country/City nodes can't currently be staffed (the "People at this node" panel only renders when the level defines roles).
- **Implementation:** mark which `Position` is a level's head (an `isHead` flag, or top-ranked non-student role per level); a team is then a query — no new `Team` table. Feeds the **position catalog** open item below.

---

## Cross-cutting tracks (run through every phase, not a phase)

These are the software practices that don't live in one milestone. They were under-covered in the planning discussion and are called out here deliberately.

### Quality & testing
- Services/repositories unit-tested (permission + scoping rules are mandatory coverage); critical flows in Playwright incl. an **offline** context. A bug fix ships with a failing-without-it test. (`ENGINEERING.md` §9)
- **Accessibility:** semantic markup, focus/keyboard, screen-reader labels — not just the sunlight-contrast we already designed for.

### Security & data protection  *(highest-priority gap)*
- **Minors' PII.** CNIC/B-form, guardian, phone of youths. Define: who can view PII (scoped like everything else), **encryption at rest**, a **retention + deletion policy**, and our posture under Pakistan's data-protection/PECA expectations. Minimise what we collect; gate PII fields behind permissions.
- **Public-form abuse:** rate-limiting + CAPTCHA/bot protection on `/apply` and `/register/team` (they write to the DB and trigger *paid* WhatsApp sends).
- **Audit log:** record who did sensitive actions (approvals, role/permission grants, hierarchy edits, form-template changes, attendance overrides) — introduced in Phase 2, extended thereafter.
- Standard hardening: input validation at every boundary (zod), Prisma (no raw SQL by default), httpOnly/SameSite cookies, secrets in env only + a rotation plan, dependency audit in CI.

### Observability & operability
- **Structured logging** + **error tracking** (e.g. Sentry) from Phase 0.
- **Alerting on the async machinery:** outbox dead-letter, cron-job failures, sync errors — we built these; we must see them fail.
- **Backups / DR:** automated DB backups + a *tested* restore, with extra care around the ETL window.

### Delivery / CI-CD / environments
- **Environments:** dev → **staging** (prod-like, safe test data) → prod. Tests and the ETL dry-run run against disposable/staging DBs, never prod.
- **CI/CD:** GitHub Actions runs lint + typecheck + tests on every PR and gates deploys; preview/staging deploy on merge.
- **Schema migrations** (distinct from the ETL): Prisma `migrate dev` → reviewed migration → `migrate deploy`; never auto-migrate prod on boot; a rollback/forward-fix policy.
- **Releases:** small focused PRs, conventional commits, a changelog; consider **feature flags** for risky rollouts (offline sync, first multi-city onboarding).

---

## Open items needing a decision (not yet settled)

- ~~**i18n / Urdu / RTL**~~ — **SETTLED: bilingual English + Urdu (RTL).** "Urdu where it counts": the whole app is built *i18n-ready* (string catalog + CSS **logical** properties `ms-/me-/text-start`, never physical `ml-/left-`), with **full Urdu + RTL on the Urdu-first public surfaces** — the `/apply` form and WhatsApp messages (Phase 5). Admin + attendance UI ship English-first with Urdu strings filled in incrementally and a full language toggle by launch (Phase 7). The **i18n foundation is laid before Phase 3** (next-intl or equivalent, locale/`dir` switch, an Urdu script font e.g. Noto Nastaliq, logical-CSS lint) so the attendance UI is built i18n-aware and the most-used screen is never retrofitted. See [[v2-i18n-bilingual-decision]].
- **Data-protection posture for minors' PII** — how strict (retention window, deletion, encryption scope, consent records). *(Awaiting input.)*
- **Reporting requirements** — *partially built ahead of Phase 7:* city + node attendance reports (by-node, status, trend, weekly, CSV), per-person history, and drill-down (node picker, breadcrumb, node-scoped people list + search). Still to spec for Phase 7: cross-level filters ("all classes"), cohort/date comparisons, and any exports admins need.
- **Permission & position catalog** — enumerate the actual permissions and the per-city default positions (the model exists; the content doesn't). *Partially settled:* the **head position per level** is fixed (see "Teams per level" above) — Ops Lead (`superadmin`), Country/City/Zone/Sector Leads, Park Admin, Murabbi — with `country_lead`/`zone_lead`/`sector_lead` still to be added to the catalog. Non-head positions per level still open.
- **Native app approach** *(future, not blocking)* — fully native (Kotlin/Swift), React Native (shares React skills/logic with the web), or a Capacitor wrapper of the PWA (fastest to app stores + background sync, least rework). Decide when closer to Phase 8.

---

## Status

**Phases 0–4 built, hardened, and redesigned** on `feat/v2-multi-city-architecture`:
- **0–3 (MVP):** org spine + `canActOn` authz, onboarding/hierarchy/roles, offline-first attendance
  (IndexedDB outbox + foreground sync engine + service worker), all on the v2 schema/DB.
- **4 (ETL):** real Islamabad data migrated + verified into the v2 Neon DB — 7 parks, ~316 people,
  198 events, 2978 attendances, 2 programmes (`prisma/etl/`).
- **Redesign:** command-center portal (sidebar + Operations/Administration groups + city switcher),
  vibecoded language across dashboard/attendance/cities/hierarchy/roles/login.
- **Hardening:** P0 (offline data-loss, JWT_SECRET fail-fast, legacy-route removal, FK RESTRICT +
  transactional delete) + P1/P2 (moveSubtree, roster-count perf, RolesEditor dirty-tracking,
  fetch-error states, assignment-uniqueness, SW deep-link, sticky errors, …).
- **Teams per level** (derived head + children's heads) and **event audience controls** (reach + segment).

### Iteration — July 2026 (post-ETL feature work, on `feat/v2-multi-city-architecture`)

- **Dynamic hierarchy (5-phase epic).** Per-city `NodeType`/`Position` are now self-describing
  (`key`/`color`/`headPositionKey`/`attachLevelKey`; `canonicalId` optional) — levels/roles are
  data-driven, not in-code maps. The real **Zone tier** was inserted for Islamabad (7 zones, parks
  re-parented under them, zone leads assigned), a **city-level role** added, and an admin **level
  editor** ships (add/rename/reorder/remove tiers + head role). Plus **node-scoped attendance
  monitoring**.
- **Interactive hierarchy editor.** Replaced the drill-down with `HierarchyWorkspace`: a unified
  **Tree ⇆ Org-chart** view with focus/re-root, search, drag-to-reparent nodes + drag-to-reassign
  people (on the real move engine), inline type-to-create, a selected-node detail pane (team +
  people + actions), and chart pan/zoom/**minimap**. Org-chart shows each unit's **lead** (class →
  murabbi, zone → zone lead, …) and opens the detail pane on click; a collapse toggle gives the
  chart full width.
- **Team attendance at every level.** Events carry a `rosterMode` (`members` | `team`); a `team`
  event's roster is the node's derived team (head + child heads), so a park/zone/city can mark its
  leads' attendance — no new mechanism, one additive column, no `Attendance` schema change. The
  marking UI now shows a **Team** chip, each person's role, the node name, and 44px tap targets.
  *(Migration `20260712000000_event_roster_mode` applied to the v2 DB.)*
- **Reporting drill-down.** The report page gained a **jump-to-node picker**, a **breadcrumb**
  trail on node reports, a **"People here"** list (everyone tracked under the node, ranked
  lowest-rate-first, linking to per-person reports), **node-scoped** people + location search, and
  person → node links. All new queries guard `view_attendance` on the relevant path and can't
  widen scope.
- **Fixes:** the home **Trail** no longer crashes for a brand-new city with no sessions.

Deployed on Railway. **Remaining before a real launch:** set a production `JWT_SECRET` on Railway
(the app now refuses to boot without it); a live browser QA pass of the new editor + team-attendance
marking; full Urdu/RTL; then Phases 5–8 (public intake + WhatsApp, assessments, hardening/security/
advanced reporting, native) — see the R&D notes. Smaller deferred polish: report **level filter**
("all classes/parks") + Reports on the mobile bottom bar; a shared `Segmented` UI atom.
