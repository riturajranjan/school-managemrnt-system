// Migrated-route mock guard (Super Admin). These routes went real (PostgreSQL/
// API) and must never reintroduce a frontend-mock authority. If someone later
// imports the mock store / mock service / mock selectors / db.saas into one of
// these pages, this test fails. See docs/backend/mock-debt.md.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

// Directories whose page/component sources must be mock-free.
const MIGRATED_ROUTE_DIRS = [
  "app/super-admin/plans",
  "app/super-admin/subscriptions",
  "app/super-admin/trials",
  "app/super-admin/billing",
  "app/super-admin/invoices",
  "app/super-admin/payments",
];

// Forbidden mock-authority markers (substring match against source text).
const FORBIDDEN: { marker: string; why: string }[] = [
  { marker: "hooks/use-store", why: "mock store hook (useSisStore)" },
  { marker: "useSisStore", why: "mock store hook" },
  { marker: "services/saas-service", why: "mock SaaS service" },
  { marker: "selectors/saas-brief", why: "mock SaaS selectors" },
  { marker: "db.saas", why: "mock SaaS store slice" },
];

function collectSources(dir: string): string[] {
  const abs = join(ROOT, dir);
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(tsx?|jsx?)$/.test(entry)) out.push(p);
    }
  };
  walk(abs);
  return out;
}

describe("migrated Super Admin routes contain no mock dependency", () => {
  for (const dir of MIGRATED_ROUTE_DIRS) {
    it(`${dir} is mock-free`, () => {
      const files = collectSources(dir);
      expect(files.length).toBeGreaterThan(0);
      const offenders: string[] = [];
      for (const file of files) {
        const src = readFileSync(file, "utf8");
        for (const { marker, why } of FORBIDDEN) {
          if (src.includes(marker)) offenders.push(`${file.replace(ROOT + "/", "")} → ${marker} (${why})`);
        }
      }
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});
