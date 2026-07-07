# Development Plan — v2

How we build the multi-city v2 app. Companion to `target-architecture.html` (the model), `v2-flows.html` (the flows), `ENGINEERING.md` (how we write code), and `MIGRATION.md` (the one-time ETL). **Plan only — no v2 app code written yet.**

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
- **Reporting requirements** — the concrete reports admins need (deferred to Phase 7; spec before building).
- **Permission & position catalog** — enumerate the actual permissions and the per-city default positions (the model exists; the content doesn't). *Partially settled:* the **head position per level** is fixed (see "Teams per level" above) — Ops Lead (`superadmin`), Country/City/Zone/Sector Leads, Park Admin, Murabbi — with `country_lead`/`zone_lead`/`sector_lead` still to be added to the catalog. Non-head positions per level still open.
- **Native app approach** *(future, not blocking)* — fully native (Kotlin/Swift), React Native (shares React skills/logic with the web), or a Capacitor wrapper of the PWA (fastest to app stores + background sync, least rework). Decide when closer to Phase 8.

---

## Status

Plan only. Next concrete deliverable: the **v2 Prisma schema** (Phase 0) against `DATABASE_URL_V2`.
