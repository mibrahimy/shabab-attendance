// Architecture boundary guard — enforces ENGINEERING.md §2 ("imports point downward")
// as a test so the layering can't silently regress. A file scan, in the same spirit
// as i18n/no-physical-css.test.ts. Three rules:
//   1. Client components (files with a "use client" directive) must not import
//      @/server/** or Prisma — the frontend reaches the backend only via fetch().
//   2. Services (src/server/services/**) must not import @/server/db or Prisma
//      directly — only repositories touch Prisma (use withTransaction for atomicity).
//   3. src/lib/** and src/types/** are pure leaves — no React, no Prisma, no @/server.

import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out; // dir may not exist
  }
  for (const name of entries) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out = out.concat(walk(p));
    else if (/\.(tsx|ts)$/.test(name) && !/\.test\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

// Module specifiers from `import … from "x"`, `export … from "x"`, and `import("x")`.
function importsOf(text: string): string[] {
  const specs: string[] = [];
  const re = /(?:import|export)\b[^;]*?\bfrom\s*["']([^"']+)["']|import\s*\(\s*["']([^"']+)["']\s*\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) specs.push(m[1] ?? m[2]);
  return specs;
}

const isPrisma = (s: string): boolean =>
  s.startsWith("@prisma/") || s.includes("prisma/generated") || s === "@/server/db";
const isServer = (s: string): boolean => s.startsWith("@/server/");
const isReact = (s: string): boolean => s === "react" || s === "react-dom" || s.startsWith("react/");

// A "use client" directive at the top of the file (allowing leading comments/blank lines).
const hasUseClient = (text: string): boolean => /^(?:\s*\/\/[^\n]*\n|\s*\n)*["']use client["']/.test(text);

describe("architecture boundaries (ENGINEERING.md §2)", () => {
  it("1. client components don't import @/server or Prisma", () => {
    const offenders: string[] = [];
    for (const root of ["src/app", "src/components", "src/hooks"]) {
      for (const file of walk(root)) {
        const text = readFileSync(file, "utf8");
        if (!hasUseClient(text)) continue; // RSC pages / API routes may call services
        for (const s of importsOf(text)) {
          if (isServer(s) || isPrisma(s)) offenders.push(`${file}  imports  ${s}`);
        }
      }
    }
    expect(
      offenders,
      `Client components must reach the backend via fetch(), not import @/server/** or Prisma:\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("2. services don't import Prisma / @/server/db directly", () => {
    const offenders: string[] = [];
    for (const file of walk("src/server/services")) {
      const text = readFileSync(file, "utf8");
      for (const s of importsOf(text)) {
        if (isPrisma(s)) offenders.push(`${file}  imports  ${s}`);
      }
    }
    expect(
      offenders,
      `Services orchestrate repositories only — Prisma lives in repositories/ (use withTransaction):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });

  it("3. lib/ and types/ are pure leaves (no React, Prisma, or @/server)", () => {
    const offenders: string[] = [];
    for (const root of ["src/lib", "src/types"]) {
      for (const file of walk(root)) {
        const text = readFileSync(file, "utf8");
        for (const s of importsOf(text)) {
          if (isReact(s) || isPrisma(s) || isServer(s)) offenders.push(`${file}  imports  ${s}`);
        }
      }
    }
    expect(
      offenders,
      `src/lib and src/types must stay pure leaves (a React hook belongs in src/hooks):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});
