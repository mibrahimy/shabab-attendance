// Generates the ETL review report from the pure transform: a machine-readable
// JSON + a human-readable Markdown of every ambiguous decision, so the user can
// sign off (or edit prisma/etl/mapping.ts) before the real load. No DB writes.
//
// Run: npm run etl:review

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { transform, type V1Dump } from "./transform";

const dir = __dirname;
const dump = JSON.parse(readFileSync(join(dir, "../data-dump.json"), "utf8")) as V1Dump;
const out = transform(dump);
const { review, counts } = out;

writeFileSync(join(dir, "review-report.json"), JSON.stringify({ counts, review }, null, 2));

const L: string[] = [];
L.push("# ETL Review Report — v1 → v2\n");
L.push("_Resolve these before the real load. Edit `prisma/etl/mapping.ts` and re-run `npm run etl:review`._\n");

L.push("## Count reconciliation\n");
L.push("| Entity | Source | Migrated |");
L.push("|---|---:|---:|");
for (const [k, v] of Object.entries(counts)) L.push(`| ${k} | ${v.source} | ${v.migrated} |`);

L.push("\n## Sub-groups (structure vs person) — 13 rows\n");
L.push("| Name | Park | Children | → | Reason |");
L.push("|---|---|---:|---|---|");
for (const s of review.subGroups) {
  const park = review.parks.find((p) => p.id === s.parkId)?.name ?? "?";
  L.push(`| ${s.name} | ${park} | ${s.children} | **${s.classification}** | ${s.reason} |`);
}

L.push("\n## Parks (8)\n");
L.push("| Name | Members | Excluded | Zone-prefixed |");
L.push("|---|---:|---|---|");
for (const p of review.parks) L.push(`| ${p.name} | ${p.members} | ${p.excluded ? "YES" : "—"} | ${p.zonePrefixed ? "yes" : "—"} |`);

L.push("\n## Programmes\n");
L.push("| Name | Events | legacyId |");
L.push("|---|---:|---|");
for (const p of review.programs) L.push(`| ${p.name} | ${p.events} | ${p.legacyId} |`);

L.push("\n## Position mapping (positionLabel → v2 canonical)\n");
L.push("| Label | Count | → canonical |");
L.push("|---|---:|---|");
for (const m of review.positionMapping) L.push(`| ${m.label} | ${m.count} | ${m.canonical} |`);

L.push("\n## Email-only users (no member link)\n");
if (review.emailOnlyUsers.length === 0) L.push("_none_");
else {
  L.push("| Name | Email | Roles | Action |");
  L.push("|---|---|---|---|");
  for (const u of review.emailOnlyUsers) L.push(`| ${u.name} | ${u.email ?? "—"} | ${u.roles} | ${u.action} |`);
}

L.push(`\n## Skips (${review.skips.length})\n`);
const bucket = new Map<string, number>();
for (const s of review.skips) {
  const key = s.replace(/^(\w+)\b.*/, "$1") + (s.includes("structural") ? " (structural subject)" : s.includes("anchor") ? " (no anchor)" : "");
  bucket.set(key, (bucket.get(key) ?? 0) + 1);
}
for (const [k, n] of bucket) L.push(`- ${k}: ${n}`);
if (review.skips.length) { L.push("\n<details><summary>all skips</summary>\n"); review.skips.forEach((s) => L.push(`- ${s}`)); L.push("\n</details>"); }

writeFileSync(join(dir, "review-report.md"), L.join("\n") + "\n");

// Console summary
console.log("\n=== ETL Review Report ===");
console.log("Counts (source → migrated):");
for (const [k, v] of Object.entries(counts)) console.log(`  ${k.padEnd(12)} ${String(v.source).padStart(5)} → ${v.migrated}`);
console.log(`\nSub-groups: ${review.subGroups.filter((s) => s.classification === "class").length} → Class, ${review.subGroups.filter((s) => s.classification === "person").length} → person`);
console.log(`Programmes: ${review.programs.map((p) => `${p.name} (${p.events})`).join(", ")}`);
console.log(`Position labels: ${review.positionMapping.map((m) => `${m.label}→${m.canonical}`).join(", ")}`);
console.log(`Email-only users: ${review.emailOnlyUsers.length}`);
console.log(`Skips: ${review.skips.length}`);
console.log(`\nWrote review-report.json + review-report.md to prisma/etl/`);
