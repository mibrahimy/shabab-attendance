// RTL guard: v2 UI must use CSS logical properties (ps-/pe-/ms-/me-/start-/end-/
// text-start/text-end), not physical LTR-only ones, so Urdu (RTL) mirrors cleanly.
// This test fails if a physical directional utility reappears in the v2 dirs.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROOTS = [
  "src/components/ui",
  "src/components/org",
  "src/components/hierarchy",
  "src/components/members",
  "src/components/roles",
  "src/components/app",
  "src/components/auth",
  "src/app/(app)",
  "src/app/(auth)",
];

// Physical Tailwind utilities that have logical equivalents. Each alternative is
// anchored so it can't fire inside a benign class: `rounded-lg`/`border-red` must
// NOT match (the `(?![a-z])` after the side letter excludes size/color words),
// while `rounded-l`, `border-r-2`, `pl-4`, `left-3`, `text-left` do.
const FORBIDDEN = new RegExp(
  [
    "(?<![\\w-])(?:pl|pr|ml|mr)-", // padding/margin left|right
    "(?<![\\w-])(?:left|right)-", // positioning
    "(?<![\\w-])text-(?:left|right)(?![\\w-])", // text alignment
    "(?<![\\w-])border-[lr](?![a-z])", // border-l / border-r (not border-red)
    "(?<![\\w-])rounded-(?:[lr]|[tb][lr])(?![a-z])", // rounded-l/-r/-tl… (not rounded-lg)
  ].join("|"),
);

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // dir may not exist yet
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

describe("no physical directional CSS in v2 UI", () => {
  it("uses logical properties only", () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of walk(root)) {
        const text = readFileSync(file, "utf8");
        text.split("\n").forEach((line, i) => {
          if (FORBIDDEN.test(line)) offenders.push(`${file}:${i + 1}  ${line.trim()}`);
        });
      }
    }
    expect(offenders, `Use logical CSS (ps-/pe-/start-/end-/text-start). Offenders:\n${offenders.join("\n")}`).toEqual([]);
  });
});
