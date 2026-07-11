// Phase 1 backfill: populate the new self-describing columns on NodeType/Position
// from the current in-code maps, so runtime behavior is unchanged when Phase 2
// starts reading columns instead of code. Idempotent (re-running sets same values).
//
// Run: npx tsx --tsconfig tsconfig.json prisma/migrate-backfill-level-config.ts
//   (reads DATABASE_URL_V2 from .env like the other v2 scripts)

import { PrismaClient } from "./generated/v2-client";

const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL_V2 } } });

// Mirrors src/lib/level-colors.ts (LEVEL_COLORS) — canonical node-level → badge color.
const LEVEL_COLORS: Record<string, string> = {
  city: "slate",
  zone: "blue",
  sector: "pink",
  park: "green",
  class: "amber",
};

// Mirrors src/lib/default-roles.ts (HEAD_CANONICAL_BY_LEVEL) — the head role per level.
const HEAD_BY_LEVEL: Record<string, string> = {
  "global-root": "superadmin",
  country: "country_lead",
  city: "city_admin",
  zone: "zone_lead",
  sector: "sector_lead",
  park: "park_admin",
  class: "murabbi",
};

// The level each canonical role attaches at: DEFAULT_ROLES.attachLevelKey for member
// roles, plus the reverse of HEAD_BY_LEVEL for the head roles (so city_admin→city,
// superadmin→global-root are covered too).
const ATTACH_BY_ROLE: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [levelKey, headKey] of Object.entries(HEAD_BY_LEVEL)) m[headKey] = levelKey;
  // DEFAULT_ROLES member/lead attach levels (agree with HEAD where they overlap):
  Object.assign(m, {
    student: "class",
    murabbi: "class",
    park_admin: "park",
    sector_lead: "sector",
    zone_lead: "zone",
    country_lead: "country",
  });
  return m;
})();

async function main() {
  const nodeTypes = await db.nodeType.findMany({ include: { canonical: true } });
  for (const nt of nodeTypes) {
    const key = nt.canonical?.key ?? nt.key;
    if (!key) {
      console.warn(`NodeType ${nt.id} has no canonical key — skipped`);
      continue;
    }
    await db.nodeType.update({
      where: { id: nt.id },
      data: {
        key,
        color: LEVEL_COLORS[key] ?? null,
        headPositionKey: HEAD_BY_LEVEL[key] ?? null,
      },
    });
  }

  const positions = await db.position.findMany({ include: { canonical: true } });
  for (const p of positions) {
    const key = p.canonical?.key ?? p.key;
    if (!key) {
      console.warn(`Position ${p.id} has no canonical key — skipped`);
      continue;
    }
    await db.position.update({
      where: { id: p.id },
      data: { key, attachLevelKey: ATTACH_BY_ROLE[key] ?? null },
    });
  }

  // Verify every row now has a key.
  const ntMissing = await db.nodeType.count({ where: { key: null } });
  const posMissing = await db.position.count({ where: { key: null } });
  const nts = await db.nodeType.findMany({ select: { cityId: true, key: true, color: true, headPositionKey: true } });
  const poss = await db.position.findMany({ select: { cityId: true, key: true, attachLevelKey: true } });
  console.log(`NodeType: ${nodeTypes.length} rows, ${ntMissing} missing key`);
  console.log(`Position: ${positions.length} rows, ${posMissing} missing key`);
  console.log("NodeType sample:", JSON.stringify(nts.slice(0, 12)));
  console.log("Position sample:", JSON.stringify(poss));
  if (ntMissing > 0 || posMissing > 0) {
    throw new Error("Backfill incomplete — some rows still have a null key");
  }
  console.log("Backfill OK — all levels/roles have key/color/head/attach populated.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
