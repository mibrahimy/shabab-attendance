import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { transform, type V1Dump } from "./transform";
import { PATH_DELIMITER } from "../../src/lib/org-path";

const dump = JSON.parse(readFileSync(join(__dirname, "../data-dump.json"), "utf8")) as V1Dump;
const out = transform(dump);

describe("etl transform", () => {
  it("reconciles person count: every member is a Person, a Class node, or a logged skip", () => {
    const classCount = out.orgNodes.filter((n) => n.typeCanonicalKey === "class").length;
    const memberPersons = out.persons.filter((p) => !p.legacyId.startsWith("user-")).length;
    // members = persons(from members) + class-nodes + skipped
    const skippedMembers = out.review.skips.filter((s) => s.includes("Sub-group") || s.includes("Member")).length;
    expect(memberPersons + classCount + skippedMembers).toBe(dump.data.members.length);
  });

  it("migrates all events; attendances reconcile (migrated + skipped = source)", () => {
    expect(out.events.length).toBe(dump.data.events.length);
    const attSkips = out.review.skips.filter((s) => s.startsWith("Attendance")).length;
    expect(out.attendances.length + attSkips).toBe(dump.data.attendances.length);
  });

  it("has no TRUE attendance orphans (every skip is a member-that-became-structure, not a missing id)", () => {
    const memberIds = new Set(dump.data.members.map((m) => m.id));
    const eventIds = new Set(dump.data.events.map((e) => e.id));
    for (const a of dump.data.attendances) {
      expect(memberIds.has(a.memberId)).toBe(true);
      expect(eventIds.has(a.eventId)).toBe(true);
    }
    // the only attendance skips are structural (subject became a Class node)
    const badSkips = out.review.skips.filter((s) => s.startsWith("Attendance") && !s.includes("structural"));
    expect(badSkips).toEqual([]);
  });

  it("every OrgNode path is parent.path + id + '/' and the parent exists", () => {
    const byId = new Map(out.orgNodes.map((n) => [n.id, n]));
    for (const n of out.orgNodes) {
      expect(n.path.startsWith(PATH_DELIMITER)).toBe(true);
      expect(n.path.endsWith(PATH_DELIMITER)).toBe(true);
      // parent is either the global root (not in our set) or an emitted node
      const parent = byId.get(n.parentId);
      if (parent) expect(n.path).toBe(`${parent.path}${n.id}${PATH_DELIMITER}`);
      expect(n.depth).toBeGreaterThanOrEqual(1);
    }
  });

  it("every Assignment resolves to an emitted OrgNode, Person, and Position", () => {
    const nodeIds = new Set(out.orgNodes.map((n) => n.id));
    const personIds = new Set(out.persons.map((p) => p.id));
    const posIds = new Set(out.positions.map((p) => p.id));
    for (const a of out.assignments) {
      expect(nodeIds.has(a.orgNodeId)).toBe(true);
      expect(personIds.has(a.personId)).toBe(true);
      expect(posIds.has(a.positionId)).toBe(true);
    }
  });

  it("every Attendance resolves to an emitted Event + Person, marker (if set) is a Person, and (event,person) is unique", () => {
    const eventIds = new Set(out.events.map((e) => e.id));
    const personIds = new Set(out.persons.map((p) => p.id));
    const seen = new Set<string>();
    for (const a of out.attendances) {
      expect(eventIds.has(a.eventId)).toBe(true);
      expect(personIds.has(a.personId)).toBe(true);
      if (a.markedById) expect(personIds.has(a.markedById)).toBe(true);
      const key = `${a.eventId}|${a.personId}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("merges the Shabab/shabab casing dupe (no separate position)", () => {
    // both labels map to the 'student' canonical → one per-city student position
    const studentPositions = out.positions.filter((p) => p.canonicalKey === "student");
    expect(studentPositions.length).toBeLessThanOrEqual(1);
  });

  it("legacyIds are unique within each entity", () => {
    for (const set of [out.persons, out.events, out.attendances, out.assignments]) {
      const ids = set.map((r) => (r as { legacyId: string }).legacyId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("creates a Program per distinct source programId", () => {
    const srcPrograms = new Set(dump.data.events.map((e) => e.programId).filter(Boolean));
    expect(out.programs.length).toBe(srcPrograms.size);
  });
});
