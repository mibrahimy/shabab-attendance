// Pure v1 → v2 transform. Takes the dump JSON + the mapping config and produces
// fully-formed v2 rows (deterministic ids, computed materialized paths) plus a
// review report of ambiguous decisions. NO database, NO Date.now(), NO randomness
// — same input ⇒ same output, so it's unit-testable and the load is a dumb upsert.
//
// See MIGRATION.md, prisma/etl/mapping.ts, and the plan.

import {
  GLOBAL_ROOT_ID,
  COUNTRY,
  ID,
  POSITION_BY_LABEL,
  STRUCTURAL_LABELS,
  POSITION_PERMISSIONS,
  POSITION_LABELS,
  PROGRAM_NAMES,
  EVENT_PARK_ALIAS,
  EXCLUDE_PARK_IDS,
  SUBGROUP_OVERRIDES,
  normalizeLabel,
} from "./mapping";
import { rootPath, buildChildPath } from "../../src/lib/org-path";

// ── Source shapes (subset we use) ───────────────────────────────────────────
export type V1Member = {
  id: string; userId: string | null; parentId: string | null; parkId: string | null;
  name: string; phone: string | null; positionLabel: string;
};
export type V1Event = {
  id: string; name: string; parkId: string | null; status: string; date: string;
  isRecurring?: boolean; programId: string | null;
};
export type V1Attendance = {
  id: string; eventId: string; memberId: string; status: string; markedById: string | null;
};
export type V1User = {
  id: string; email: string | null; name: string; phone: string | null; roles: string; isActive: boolean;
};
export type V1Dump = {
  data: {
    cities: { id: string; name: string }[];
    parks: { id: string; name: string }[];
    members: V1Member[];
    events: V1Event[];
    attendances: V1Attendance[];
    users: V1User[];
  };
};

// ── v2 output shapes ────────────────────────────────────────────────────────
export type V2OrgNode = {
  id: string; legacyId: string | null; name: string; typeCanonicalKey: string;
  parentId: string; path: string; depth: number; countryId: string | null; cityId: string | null;
};
export type V2Position = { id: string; cityId: string; canonicalKey: string; label: string; permissionKeys: string[] };
export type V2Person = {
  id: string; legacyId: string; name: string; cnic: string | null; phone: string | null;
  email: string | null; status: "active"; cityId: string;
};
export type V2User = { id: string; personId: string; email: string | null; roles: string; isActive: boolean };
export type V2Assignment = { id: string; legacyId: string; personId: string; orgNodeId: string; positionId: string; cityId: string };
export type V2Program = { id: string; legacyId: string; name: string };
export type V2Event = {
  id: string; legacyId: string; title: string; orgNodeId: string; rosterDepth: number | null;
  programId: string; status: "scheduled" | "completed" | "cancelled"; scheduledAt: string;
  recurring: boolean; cityId: string;
};
export type V2Attendance = {
  id: string; legacyId: string; eventId: string; personId: string;
  status: "present" | "late" | "absent" | "excused"; markedById: string | null;
};

export type ReviewReport = {
  subGroups: { id: string; name: string; parkId: string | null; children: number; classification: "class" | "person" | "drop"; reason: string }[];
  parks: { id: string; name: string; members: number; excluded: boolean; zonePrefixed: boolean }[];
  programs: { legacyId: string; name: string; events: number }[];
  positionMapping: { label: string; count: number; canonical: string | "STRUCTURAL" | "UNMAPPED" }[];
  emailOnlyUsers: { email: string | null; name: string; roles: string; action: string }[];
  skips: string[];
};

export type Transformed = {
  orgNodes: V2OrgNode[];
  positions: V2Position[];
  persons: V2Person[];
  users: V2User[];
  assignments: V2Assignment[];
  programs: V2Program[];
  events: V2Event[];
  attendances: V2Attendance[];
  review: ReviewReport;
  counts: Record<string, { source: number; migrated: number }>;
};

const STATUS_EVENT: Record<string, V2Event["status"]> = { completed: "completed", scheduled: "scheduled", cancelled: "cancelled" };
const STATUS_ATT: Record<string, V2Attendance["status"]> = { present: "present", late: "late", absent: "absent", excused: "excused" };

export function transform(dump: V1Dump): Transformed {
  const { cities, parks, members, events, attendances, users } = dump.data;
  const skips: string[] = [];

  // ── 1. Structural spine: country → city → parks → classes ────────────────
  const city = cities[0];
  if (!city) throw new Error("No city in dump");
  const cityId = ID.city(city.id);
  const countryPath = buildChildPath(rootPath(GLOBAL_ROOT_ID), COUNTRY.id);
  const cityPath = buildChildPath(countryPath, cityId);

  const orgNodes: V2OrgNode[] = [
    { id: COUNTRY.id, legacyId: null, name: COUNTRY.name, typeCanonicalKey: "country", parentId: GLOBAL_ROOT_ID, path: countryPath, depth: 1, countryId: COUNTRY.id, cityId: null },
    { id: cityId, legacyId: city.id, name: city.name, typeCanonicalKey: "city", parentId: COUNTRY.id, path: cityPath, depth: 2, countryId: COUNTRY.id, cityId },
  ];

  const includedParks = parks.filter((p) => !EXCLUDE_PARK_IDS.has(p.id));
  const parkNodeId = new Map<string, string>(); // v1 parkId → v2 node id
  for (const p of includedParks) {
    const id = ID.park(p.id);
    parkNodeId.set(p.id, id);
    orgNodes.push({ id, legacyId: p.id, name: p.name, typeCanonicalKey: "park", parentId: cityId, path: buildChildPath(cityPath, id), depth: 3, countryId: COUNTRY.id, cityId });
  }

  // ── 2. Classify Sub-group rows (structure vs person) ─────────────────────
  const memberById = new Map(members.map((m) => [m.id, m]));
  const childCount = new Map<string, number>();
  for (const m of members) if (m.parentId) childCount.set(m.parentId, (childCount.get(m.parentId) ?? 0) + 1);

  const subgroupClass = new Map<string, "class" | "person" | "drop">();
  const reviewSubGroups: ReviewReport["subGroups"] = [];
  for (const m of members) {
    if (!STRUCTURAL_LABELS.has(m.positionLabel)) continue;
    const kids = childCount.get(m.id) ?? 0;
    const decided = SUBGROUP_OVERRIDES[m.id] ?? (kids > 0 ? "class" : "person");
    subgroupClass.set(m.id, decided);
    reviewSubGroups.push({
      id: m.id, name: m.name, parkId: m.parkId, children: kids, classification: decided,
      reason: SUBGROUP_OVERRIDES[m.id] ? "override" : kids > 0 ? `${kids} children → group` : "0 children → person",
    });
  }

  // Class OrgNodes from sub-groups classified "class" (under their park).
  const classNodeId = new Map<string, string>(); // v1 subgroupId → v2 class node id
  for (const [sgId, kind] of subgroupClass) {
    if (kind !== "class") continue;
    const sg = memberById.get(sgId)!;
    const parkNode = sg.parkId ? parkNodeId.get(sg.parkId) : undefined;
    if (!parkNode) { skips.push(`Sub-group ${sgId} "${sg.name}" has no included park → class dropped`); continue; }
    const id = ID.klass(sgId);
    classNodeId.set(sgId, id);
    const parkNodeRow = orgNodes.find((n) => n.id === parkNode)!;
    orgNodes.push({ id, legacyId: sgId, name: sg.name, typeCanonicalKey: "class", parentId: parkNode, path: buildChildPath(parkNodeRow.path, id), depth: 4, countryId: COUNTRY.id, cityId });
  }

  // ── 3. Anchor derivation: nearest class-subgroup ancestor, else the park ──
  function anchorFor(m: V1Member): string | null {
    let cur: string | null = m.parentId;
    const seen = new Set<string>();
    while (cur && !seen.has(cur)) {
      seen.add(cur);
      if (classNodeId.has(cur)) return classNodeId.get(cur)!;
      cur = memberById.get(cur)?.parentId ?? null;
    }
    return m.parkId ? parkNodeId.get(m.parkId) ?? null : null;
  }

  // ── 4. People + assignments (skip structural class-subgroups) ────────────
  const persons: V2Person[] = [];
  const assignments: V2Assignment[] = [];
  const personIds = new Set<string>();
  const usedCanonicals = new Set<string>();
  const labelCounts = new Map<string, number>();

  for (const m of members) {
    labelCounts.set(m.positionLabel, (labelCounts.get(m.positionLabel) ?? 0) + 1);
    if (subgroupClass.get(m.id) === "class") continue; // became a Class node
    if (subgroupClass.get(m.id) === "drop") { skips.push(`Sub-group ${m.id} dropped by override`); continue; }
    const anchor = anchorFor(m);
    if (!anchor) { skips.push(`Member ${m.id} "${m.name}" has no derivable anchor (park excluded?) → skipped`); continue; }

    const pid = ID.person(m.id);
    persons.push({ id: pid, legacyId: m.id, name: m.name, cnic: null, phone: m.phone, email: null, status: "active", cityId });
    personIds.add(pid);

    const canonical = POSITION_BY_LABEL[normalizeLabel(m.positionLabel)] ?? "student";
    usedCanonicals.add(canonical);
    assignments.push({ id: ID.assignment(m.id), legacyId: m.id, personId: pid, orgNodeId: anchor, positionId: ID.position(cityId, canonical), cityId });
  }

  // ── 5. Per-city Positions for the canonicals actually used ───────────────
  const positions: V2Position[] = [...usedCanonicals].map((key) => ({
    id: ID.position(cityId, key), cityId, canonicalKey: key,
    label: POSITION_LABELS[key] ?? key, permissionKeys: POSITION_PERMISSIONS[key] ?? [],
  }));

  // ── 6. Users (linked to a member's person, or email-only → own person) ───
  const memberByUserId = new Map<string, V1Member>();
  for (const m of members) if (m.userId) memberByUserId.set(m.userId, m);

  const usersOut: V2User[] = [];
  const emailOnlyUsers: ReviewReport["emailOnlyUsers"] = [];
  for (const u of users) {
    const linked = memberByUserId.get(u.id);
    if (linked && personIds.has(ID.person(linked.id))) {
      usersOut.push({ id: ID.user(u.id), personId: ID.person(linked.id), email: u.email, roles: u.roles, isActive: u.isActive });
    } else {
      // Email-only account → synthesize a Person so the login has an identity.
      const pid = ID.person(`user-${u.id}`);
      persons.push({ id: pid, legacyId: `user-${u.id}`, name: u.name, cnic: null, phone: u.phone, email: u.email, status: "active", cityId });
      personIds.add(pid);
      usersOut.push({ id: ID.user(u.id), personId: pid, email: u.email, roles: u.roles, isActive: u.isActive });
      emailOnlyUsers.push({ email: u.email, name: u.name, roles: u.roles, action: "migrate as email-login Person (no assignment)" });
    }
  }

  // ── 7. Programs (distinct programId on events) ───────────────────────────
  const progEventCount = new Map<string, number>();
  for (const e of events) if (e.programId) progEventCount.set(e.programId, (progEventCount.get(e.programId) ?? 0) + 1);
  const programs: V2Program[] = [...progEventCount.keys()].map((pid) => ({
    id: ID.program(pid), legacyId: pid, name: PROGRAM_NAMES[pid] ?? `Programme ${pid.slice(0, 8)}`,
  }));

  // ── 8. Events (anchor @ park, whole-subtree roster) ──────────────────────
  const eventsOut: V2Event[] = [];
  const eventIds = new Set<string>();
  for (const e of events) {
    // Event.parkId uses a different id system than the parks table — bridge it.
    const realParkId = e.parkId ? EVENT_PARK_ALIAS[e.parkId] ?? e.parkId : undefined;
    const orgNode = realParkId ? parkNodeId.get(realParkId) : undefined;
    if (!orgNode) { skips.push(`Event ${e.id} "${e.name}" park excluded/missing → skipped`); continue; }
    if (!e.programId) { skips.push(`Event ${e.id} has no programId → skipped`); continue; }
    const id = ID.event(e.id);
    eventIds.add(id);
    eventsOut.push({
      id, legacyId: e.id, title: e.name, orgNodeId: orgNode, rosterDepth: null,
      programId: ID.program(e.programId), status: STATUS_EVENT[e.status] ?? "scheduled",
      scheduledAt: new Date(e.date).toISOString(), recurring: Boolean(e.isRecurring), cityId,
    });
  }

  // ── 9. Attendances (upsert by (event,person); dedupe last-wins) ──────────
  const attByKey = new Map<string, V2Attendance>();
  for (const a of attendances) {
    const eId = ID.event(a.eventId);
    const pId = ID.person(a.memberId);
    if (!eventIds.has(eId)) { skips.push(`Attendance ${a.id} → missing event ${a.eventId}`); continue; }
    if (!personIds.has(pId)) { skips.push(`Attendance ${a.id} → member ${a.memberId} not a person (structural?)`); continue; }
    const markedBy = a.markedById && personIds.has(ID.person(a.markedById)) ? ID.person(a.markedById) : null;
    attByKey.set(`${eId}|${pId}`, {
      id: ID.attendance(a.id), legacyId: a.id, eventId: eId, personId: pId,
      status: STATUS_ATT[a.status] ?? "absent", markedById: markedBy,
    });
  }
  const attendancesOut = [...attByKey.values()];

  // ── Review report ────────────────────────────────────────────────────────
  const structuralPositionLabels = new Set([...STRUCTURAL_LABELS]);
  const positionMapping: ReviewReport["positionMapping"] = [...labelCounts.entries()].map(([label, count]) => ({
    label, count,
    canonical: structuralPositionLabels.has(label) ? "STRUCTURAL" : POSITION_BY_LABEL[normalizeLabel(label)] ?? "UNMAPPED",
  }));

  const memByPark = new Map<string, number>();
  for (const m of members) if (m.parkId) memByPark.set(m.parkId, (memByPark.get(m.parkId) ?? 0) + 1);

  const review: ReviewReport = {
    subGroups: reviewSubGroups.sort((a, b) => b.children - a.children),
    parks: parks.map((p) => ({ id: p.id, name: p.name, members: memByPark.get(p.id) ?? 0, excluded: EXCLUDE_PARK_IDS.has(p.id), zonePrefixed: /zone\s*\d/i.test(p.name) })),
    programs: programs.map((p) => ({ legacyId: p.legacyId, name: p.name, events: progEventCount.get(p.legacyId) ?? 0 })),
    positionMapping: positionMapping.sort((a, b) => b.count - a.count),
    emailOnlyUsers,
    skips,
  };

  const counts: Transformed["counts"] = {
    persons: { source: members.length, migrated: persons.length },
    parks: { source: parks.length, migrated: includedParks.length },
    classes: { source: reviewSubGroups.length, migrated: classNodeId.size },
    events: { source: events.length, migrated: eventsOut.length },
    attendances: { source: attendances.length, migrated: attendancesOut.length },
    users: { source: users.length, migrated: usersOut.length },
    programs: { source: progEventCount.size, migrated: programs.length },
    assignments: { source: members.length, migrated: assignments.length },
  };

  return { orgNodes, positions, persons, users: usersOut, assignments, programs, events: eventsOut, attendances: attendancesOut, review, counts };
}
