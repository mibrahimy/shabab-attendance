# Data Migration — live DB → v2

A **one-time ETL** that transforms the current production data into the v2 schema. This is a *transform* (old shape → new shape), distinct from the later **Neon → Railway Postgres** move (a same-schema lift-and-shift; see `ENGINEERING.md` §15).

> **The live database is read-only.** We never mutate `DATABASE_URL`. We extract a JSON dump from it and load into `DATABASE_URL_V2`.

---

## 0. What this data actually is

**The entire live DB is the *Murabbi Training* programme's attendance — nothing else.** Every event is a weekly training session; every person is a murabbi trainee or a member of the training leadership. There are no shabab/students and no other programmes in this data. The ETL therefore creates a single `Program = "Murabbi Training"` and scopes all migrated events + attendance to it.

### Source profile (from `prisma/data-dump.json`, produced by `prisma/dump-data.ts`)

| Entity | Count | Notes |
|---|---|---|
| City | 1 | Islamabad |
| Park | 8 | every member has a `parkId` |
| Member | 357 | self-ref tree (`parentId`, depth ≤ 2 under park); `positionLabel` is a string |
| Event | 200 | all `type = weekly_session`; 118 completed / 82 scheduled |
| Attendance | 3057 | present 1808 / absent 843 / excused 308 / late 98; only 1088 carry `markedById` |
| User | 11 | 8 linked to members (7 Masool + 1 Teacher); roles super_admin / admin / teacher; **no CNIC anywhere** |

`positionLabel` distribution: Member 188 · Murabbi 89 · Naqeeb 24 · Shabab 20 + shabab 3 · Masool 18 · Sub-group 13 · Park Admin 1 · Teacher 1.

**Structure is interleaved with people** (the core thing v2 untangles). The only inner (parent) nodes are `Masool` (8) and `Sub-group` (10), giving a de-facto `Park → Masool → Sub-group → people` shape. **`Sub-group` is acting as the Class/Halqa level**, but the label is overloaded — some rows are real groups (e.g. "Park I-9" with 31 children), some are person-named.

**Attendance is marked for everyone** (all positions, including leadership), not only trainees — so migrated events anchor at the **Park** with the whole-park subtree as roster and `audience = null`.

### Known data-quality issues (surface, don't silently fix)
- Casing dupe `Shabab` / `shabab` → merge.
- `classAssignment` effectively unused (1 row, value `"High"`) → drop.
- `isTeaching` effectively unused (1 row true) → drop.
- Park `6ce367df…` is a **council/test park** full of `Member` rows named after other parks' Masools → **review report**, manual keep/exclude.
- No CNICs anywhere → legacy accounts migrate with **email-login fallback** (below).

---

## 1. Mapping decisions (settled)

| Source | → v2 | Rule |
|---|---|---|
| City "Islamabad" | `OrgNode` (City) under Pakistan under global root | structural spine: root → Pakistan → Islamabad → Parks → Classes |
| Park (×8) | `OrgNode` (Park) | path computed top-down |
| `Sub-group` (×13) | **review report** | no auto-decision — classify each as a Class `OrgNode` or a person before load |
| `Masool` / `Naqeeb` / `Park Admin` | training-leadership `Position` @ Park | the people who run/mark sessions |
| `Murabbi` (89) + `Member` (188) | **murabbi trainees** → `Person` + `Assignment` @ park (or class once resolved) | `Member` = trainee in the Murabbi Training programme |
| `Teacher` (1) | `Murabbi` (legacy alias) | |
| `Shabab` + `shabab` (23) | `Person` (merge casing) | present in data but not the focus of this programme |
| `Member.parentId` tree | **dropped as a person-tree** | authority comes from `Position` rank + the OrgNode anchor, not `parentId`; the chain is only used to derive each person's anchor node |
| `Event` (200) | `Event` @ Park, `rosterDepth` = whole subtree, `audience = null`, **`programId = Murabbi Training`** | |
| `Attendance` (3057) | `Attendance` (`memberId` → Person, `markedById` → marker's Person) | upsert `(eventId, personId)` |
| segment (jr/sr) | **null** | no source data; backfill later |
| `User` (11) | `User` with nullable `cnic` + `email` | **email-login fallback**: login resolves by CNIC **or** email; CNIC required for *new* accounts only — two schemes coexist by design |

---

## 2. ETL pipeline — four phases (idempotent + reviewable)

```
1. EXTRACT    prisma/dump-data.ts → prisma/data-dump.json   (re-dumpable anytime)
2. TRANSFORM  pure fns + a version-controlled MAPPING config
              → v2 entities  +  a REVIEW REPORT of ambiguous rows
3. LOAD       via v2 repositories, in FK/path order, UPSERT BY legacyId
4. VERIFY     row-count reconciliation + spot checks
```

**Re-runnability is the design constraint.** Every v2 row carries the old cuid as a unique **`legacyId`**, and load is **upsert-by-`legacyId`**. Refine a mapping, re-run, no duplicates. Expect to iterate — the source is messy.

**Load order** (respects FKs + materialized paths):
1. `OrgNode`s: root → Pakistan → Islamabad → 8 Parks → Classes — paths computed **top-down**.
2. `Position`s (+ canonical).
3. `Person`s (357) and `User`s (11).
4. `Assignment`s (person × position × orgNode).
5. `Event`s (200) — tagged `programId = Murabbi Training`.
6. `Attendance`s (3057).

**The review report** (phase 2 output, resolved before/between loads): all 13 `Sub-group` rows; the council/test park; any member whose anchor node can't be derived; any unmapped `positionLabel`. The transform is otherwise deterministic and config-driven.

---

## 3. Verification (phase 4)

- **Counts reconcile:** 357 persons, 200 events, 3057 attendances; every attendee resolves to a Person; every event to a Park OrgNode.
- **No orphans:** every `Assignment` points at a real OrgNode + Position; every `Attendance` at a real Event + Person.
- **Spot checks:** pick 3 parks, confirm their roster + a known event's attendance match the source.
- **Path integrity:** every OrgNode `path` is a valid prefix chain; subtree prefix-scans return the expected members.
- Runs against a **disposable DB first**, never straight into the live or v2 production DB.

---

## 4. Status

Plan only — no migration code written yet. Source dump exists at `prisma/data-dump.json`. Next deliverable is the transform + mapping config and the review-report generator.
