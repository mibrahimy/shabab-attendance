// Student-intake use-cases (ROADMAP SI-2, folding in SI-5). The launch-critical,
// mobile-first surface: a park admin's OWN classes — the student-attach leaf level
// — each named by its head murabbi, with a direct "Add shabab" affordance. No
// org-tree navigation.
//
// Scope mirrors event-service.listCreatableNodes: an add_member grant covers the
// whole subtree under its anchor, so we EXPAND each anchor into every real node
// beneath it, dedupe, then keep only class-level nodes. The murabbi name reuses the
// exact bulk head query the hierarchy tree uses (assignment-repo.listHeadsInCity),
// so intake and the tree can't disagree about who heads a class.

import type { AuthzContext } from "@/types/auth";
import type { IntakeClass } from "@/types/intake";
import { PATH_DELIMITER } from "@/lib/org-path";
import { DEFAULT_ROLES } from "@/lib/default-roles";
import * as orgNodeRepo from "@/server/repositories/org-node-repo";
import * as nodeTypeRepo from "@/server/repositories/node-type-repo";
import * as assignmentRepo from "@/server/repositories/assignment-repo";

const ADD_MEMBER = "add_member";

// The org level(s) a student attaches at (the "class" leaf) and the student role
// keys — both static from the role catalog. Used to keep only class-level nodes and
// to count only shabab (not the class's own head) in each class.
const STUDENT_LEVEL_KEYS = new Set(
  DEFAULT_ROLES.filter((r) => r.isStudent).map((r) => r.attachLevelKey),
);
const STUDENT_ROLE_KEYS = DEFAULT_ROLES.filter((r) => r.isStudent).map((r) => r.canonicalKey);

// The classes the caller may add shabab to. Empty when they hold no add_member
// grant (the surface then renders its empty state; the POST also re-checks).
export async function listIntakeClasses(ctx: AuthzContext): Promise<IntakeClass[]> {
  const anchorPaths = [
    ...new Set(ctx.grants.filter((g) => g.permission === ADD_MEMBER).map((g) => g.anchorPath)),
  ];
  if (anchorPaths.length === 0) return [];

  // Expand each anchor into its subtree (nested anchors overlap → dedupe by id).
  const subtrees = await Promise.all(anchorPaths.map((p) => orgNodeRepo.listSubtree(p)));
  const byId = new Map<string, orgNodeRepo.SubtreeNode>();
  for (const nodes of subtrees) for (const n of nodes) byId.set(n.id, n);
  const allNodes = [...byId.values()];

  // Keep only class-level nodes (the student-attach leaf) that sit inside a city.
  const classes = allNodes.filter((n) => STUDENT_LEVEL_KEYS.has(n.level.key) && n.cityId);
  if (classes.length === 0) return [];

  // Readable location: the ancestor chain (excluding the class itself), from the
  // names available within the loaded scope. A park admin whose anchor is the park
  // sees "Park A"; a superadmin (whole tree loaded) sees the full path.
  const nameById = new Map(allNodes.map((n) => [n.id, n.name] as const));
  const labelFor = (n: orgNodeRepo.SubtreeNode): string =>
    n.path
      .split(PATH_DELIMITER)
      .filter(Boolean)
      .slice(0, -1) // drop the class's own id — its name is the card title
      .map((id) => nameById.get(id))
      .filter((name): name is string => Boolean(name))
      .join(" / ");

  // Murabbi name per class: reuse the bulk city heads query. Group by city so a
  // multi-city admin resolves heads against each city's own level template.
  const byCity = new Map<string, orgNodeRepo.SubtreeNode[]>();
  for (const c of classes) {
    const arr = byCity.get(c.cityId!) ?? [];
    arr.push(c);
    byCity.set(c.cityId!, arr);
  }

  const murabbiByNode = new Map<string, string>();
  await Promise.all(
    [...byCity.keys()].map(async (cityId) => {
      const levels = await nodeTypeRepo.listCityLevels(cityId);
      const headKeyByTypeId = new Map<string, string>();
      const headKeys = new Set<string>();
      for (const l of levels) {
        if (l.headPositionKey) {
          headKeyByTypeId.set(l.id, l.headPositionKey);
          headKeys.add(l.headPositionKey);
        }
      }
      const headRows = await assignmentRepo.listHeadsInCity(cityId, [...headKeys]);
      for (const r of headRows) {
        // Keep only the head whose position matches its OWN level's head key (so a
        // same-key role anchored elsewhere never becomes a class's murabbi).
        if (headKeyByTypeId.get(r.typeId) === r.positionKey && !murabbiByNode.has(r.orgNodeId)) {
          murabbiByNode.set(r.orgNodeId, r.personName);
        }
      }
    }),
  );

  const counts = await assignmentRepo.countStudentsByNodes(
    classes.map((c) => c.id),
    STUDENT_ROLE_KEYS,
  );

  return classes
    .map((n) => ({
      nodeId: n.id,
      name: n.name,
      pathLabel: labelFor(n),
      cityId: n.cityId!,
      murabbiName: murabbiByNode.get(n.id) ?? null,
      studentCount: counts.get(n.id) ?? 0,
    }))
    .sort((a, b) => (a.pathLabel + a.name).localeCompare(b.pathLabel + b.name));
}
