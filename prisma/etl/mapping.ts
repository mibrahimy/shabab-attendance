// ETL mapping config — the version-controlled decisions that drive the pure
// transform (prisma/etl/transform.ts). Everything ambiguous about the v1 → v2
// migration lives here so a decision is a one-line edit + re-run (idempotent,
// upsert-by-legacyId). See MIGRATION.md and the plan.
//
// Nothing here touches a database.

// ── Structural spine ────────────────────────────────────────────────────────
// The existing seeded global root (prisma/v2/seed.ts) we hang everything under.
export const GLOBAL_ROOT_ID = "org-global-root";

// New synthetic ancestors (no v1 source row → deterministic ids, legacyId null).
export const COUNTRY = { id: "org-pk", name: "Pakistan" } as const;

// Deterministic id prefixes so paths are stable across re-runs (path embeds ids).
export const ID = {
  city: (v1CityId: string) => `org-city-${v1CityId}`,
  park: (v1ParkId: string) => `org-park-${v1ParkId}`,
  klass: (v1SubgroupId: string) => `org-class-${v1SubgroupId}`,
  person: (v1MemberId: string) => `p-${v1MemberId}`,
  user: (v1UserId: string) => `u-${v1UserId}`,
  assignment: (v1MemberId: string) => `a-${v1MemberId}`,
  program: (v1ProgramId: string) => `prog-${v1ProgramId}`,
  event: (v1EventId: string) => `e-${v1EventId}`,
  attendance: (v1AttId: string) => `att-${v1AttId}`,
  // One per-city Position per canonical role used in the migration.
  position: (cityId: string, canonicalKey: string) => `pos-${cityId}-${canonicalKey}`,
} as const;

// ── positionLabel → v2 canonical Position ───────────────────────────────────
// v2 canonical positions available (prisma/v2/seed.ts): park_admin, murabbi,
// student. The person's structural anchor (park/class) bounds authority; the
// position decides who can mark. REVIEW: confirm Masool/Naqeeb especially.
export const POSITION_BY_LABEL: Record<string, string> = {
  Masool: "park_admin", // sector/park leadership — runs & marks sessions
  "Park Admin": "park_admin",
  Naqeeb: "murabbi", // sub-group lead — can mark
  Murabbi: "murabbi", // murabbi trainee (the programme's focus)
  Teacher: "murabbi", // legacy alias
  Member: "student", // trainee attendee (no login)
  Shabab: "student",
  shabab: "student", // casing dupe → merged into Shabab handling
  // "Sub-group" is NOT a person — it's structure (→ Class node); handled separately.
};

// positionLabels that denote STRUCTURE, not a person.
export const STRUCTURAL_LABELS = new Set(["Sub-group"]);

// Canonical positions we instantiate per-city, with the permission grants they
// confer (keys from prisma/v2/seed.ts permissions). Mirrors src/lib/default-roles.
export const POSITION_PERMISSIONS: Record<string, string[]> = {
  park_admin: ["manage_hierarchy", "add_member", "create_event", "mark_attendance", "view_attendance"],
  murabbi: ["create_event", "mark_attendance", "view_attendance"],
  student: [],
};

export const POSITION_LABELS: Record<string, string> = {
  park_admin: "Park Admin",
  murabbi: "Murabbi",
  student: "Student",
};

// ── Programmes ──────────────────────────────────────────────────────────────
// The dump has no Program table — only two programId values on events.
// REVIEW: confirm names / whether to merge. Default: keep both.
export const PROGRAM_NAMES: Record<string, string> = {
  "93f9cb6d-a2ab-42b8-8b7c-5201c58a388f": "Murabbi Training",
  "9f10b2cb-6c48-4458-8047-e02f703f252f": "Murabbi Training — Programme 2",
};

// ── Event → Park id bridge ──────────────────────────────────────────────────
// v1 inconsistency: Event.parkId uses a DIFFERENT id system (cuids) than the
// `parks` table (UUIDs). They map 1:1 by zone; this explicit, auditable table
// bridges each Event.parkId → the real Park UUID (derived by zone-name match).
export const EVENT_PARK_ALIAS: Record<string, string> = {
  "cmmflh5y60001iwmk7t20behk": "881fbbba-84c9-40fd-8ceb-14719d497446", // Zone 1 - Park 1
  "cmmflj14i00dviwmkc3ts3qrk": "92f97f0b-d764-4f30-9ff5-fe11ba3d80b4", // Zone 2 - Park 1
  "cmmfll3qj00tliwmkqsdlu582": "34be0480-0afb-4818-b30b-7448a9af0505", // Zone 3 - Park 1
  "cmmflowhi01lfiwmkivnxb26g": "2e9805dd-af3a-4fcb-a3de-fce0a1cf4265", // Zone 4 - Park 1
  "cmmflsept02bjiwmk5she89sp": "c1d2f111-9496-4f44-be1e-3e1adceed533", // Zone 5 Asadullah - Park 1
  "cmmflul3t02q5iwmk4wpqmwn8": "1fb7a7d0-995a-424b-b994-20eff6daa27d", // Zone 6 Babar - Park 1
  "cmmflwn4l0353iwmk7htxooli": "8a830592-e01e-4d0f-8071-843115874d6e", // Zone 7 Al Quds - Park 1
  "cmoynqvwt0001iwzey04pkd42": "6ce367df-b556-4291-93c6-560d7c04c3e8", // Shabab Friday Study Circle - Park 1
};

// ── Exclusions & merges ─────────────────────────────────────────────────────
// The suspected council/test park. REVIEW: keep as a real Park or exclude.
// Default (per MIGRATION.md suspicion): EXCLUDE — flip to false to include.
export const EXCLUDE_PARK_IDS = new Set<string>([
  // "Shabab Friday Study Circle" is NOT a park — it's a city-wide event for all
  // Islamabad murabbis (its 35 "members" are attendees, largely duplicates of
  // murabbis in the real parks). Excluded for now; re-add later as a proper
  // Islamabad-wide event from the dump's attendee list. (User decision 2026-07.)
  "6ce367df-b556-4291-93c6-560d7c04c3e8",
]);

// Sub-group classification default: has children → real group (→ Class node);
// zero children → treat the row as a person, not a class. Overridable per-id.
// REVIEW fills SUBGROUP_OVERRIDES with explicit "class" | "person" | "drop".
export const SUBGROUP_OVERRIDES: Record<string, "class" | "person" | "drop"> = {};

// Merge casing dupes on positionLabel before mapping (Shabab/shabab).
export function normalizeLabel(label: string): string {
  return label === "shabab" ? "Shabab" : label;
}
