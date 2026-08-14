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
  "app/super-admin/health",
  "app/super-admin/usage",
  "app/super-admin/support",
  "app/super-admin/features",
  "app/super-admin/domains",
  "app/super-admin/branding",
  "app/super-admin/addons",
  "app/super-admin/marketplace",
  "app/super-admin/settings",
  "app/super-admin/announcements",
  "app/super-admin/status",
  "app/super-admin/audit",
  "app/super-admin/activity",
  "app/super-admin/permissions",
];

// Individual migrated files (not whole directories) that must stay mock-free.
// The dashboard page still legitimately uses db.saas for not-yet-migrated tiles,
// but its Platform Pulse widget + usage meter are real — guard those components.
// The Super Admin layout + global search are fully real (server-side search).
const MIGRATED_FILES = [
  "components/super-admin/platform-pulse.tsx",
  "components/super-admin/usage-meter.tsx",
  "components/super-admin/global-search.tsx",
  "app/super-admin/layout.tsx",
  "app/super-admin/page.tsx", // dashboard — fully real (SA-4J)
  // Phase 6-pre — the migrated academics-foundation pages (real Class/Section/
  // Enrollment). The class DETAIL page ([classId]) intentionally stays on the
  // mock store (bound to still-mock Subjects/Teachers/Timetable/Homework/Exams),
  // so only these two files are guarded — not the whole app/academics dir.
  "app/academics/classes/page.tsx",
  "app/academics/sections/page.tsx",
  // Phase 6 — the real Subjects catalogue + Class↔Subject assignment surface,
  // fully backed by /api/academics/subjects + /api/academics/classes/[id]/
  // subjects (PostgreSQL). It must never reintroduce the mock subjects store/
  // service/hooks/seed. The class DETAIL page ([classId]) still composes the
  // mock Subjects/Teachers/Timetable/Homework/Exams tabs and is NOT migrated.
  "app/academics/subjects/page.tsx",
  // Phase 7B.2 — the real Timetable builder + view, fully backed by
  // /api/timetable/* (PostgreSQL). No mock timetable store/service/hooks/seed,
  // no client conflict engine. The academics DASHBOARD + class DETAIL stay mock.
  "app/academics/timetable/page.tsx",
  "app/academics/timetable/create/page.tsx",
  "components/academics/timetable/real-timetable-grid.tsx",
  // Phase 5B — the real Student Attendance surfaces (dashboard + reports +
  // marker). Fully backed by /api/attendance/* (PostgreSQL). They must never
  // reintroduce the student-attendance mock store/hooks/selectors/seed. Staff
  // Attendance + Leave stay on the mock store, so only these files are guarded,
  // not the whole app/attendance dir.
  "app/attendance/page.tsx",
  "app/attendance/reports/page.tsx",
  "app/attendance/students/page.tsx",
  "components/attendance/attendance-marker.tsx",
];

// Forbidden mock-authority markers (substring match against source text).
const FORBIDDEN: { marker: string; why: string }[] = [
  { marker: "hooks/use-store", why: "mock store hook (useSisStore)" },
  { marker: "useSisStore", why: "mock store hook" },
  { marker: "services/saas-service", why: "mock SaaS service" },
  { marker: "selectors/saas-brief", why: "mock SaaS selectors" },
  { marker: "db.saas", why: "mock SaaS store slice" },
  // Phase 5B — student-attendance mock authority (real surfaces must not import).
  { marker: 'hooks/use-attendance"', why: "mock attendance hooks (use hooks/api/use-attendance)" },
  { marker: "selectors/attendance-insights", why: "mock attendance selectors" },
  { marker: "services/attendance-service", why: "mock attendance service" },
  { marker: "data/seed/attendance", why: "mock attendance seed" },
  { marker: "data/seed/reference", why: "mock reference seed (schoolClasses/classLabel)" },
  // Phase 6 — academics-subjects mock authority (real surfaces must not import).
  { marker: 'hooks/use-academics"', why: "mock academics hooks (use hooks/api/use-academics-subjects)" },
  { marker: "services/subjects-service", why: "mock subjects service" },
  { marker: "data/seed/academics", why: "mock academics seed" },
  // Phase 6A — staff/teacher mock authority (real surfaces must use hooks/api/use-staff).
  { marker: "services/hr-service", why: "mock HR/staff service" },
  { marker: 'hooks/use-hr"', why: "mock HR hooks" },
  { marker: "data/seed/hr", why: "mock HR/staff seed" },
  // Phase 7 — timetable mock authority (real surfaces must use hooks/api/use-timetable-api).
  { marker: 'hooks/use-timetable"', why: "mock timetable hooks" },
  { marker: "services/timetable-service", why: "mock timetable service" },
  { marker: "data/seed/timetable", why: "mock timetable seed" },
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

function offendersIn(files: string[]): string[] {
  const offenders: string[] = [];
  for (const file of files) {
    const src = readFileSync(file, "utf8");
    for (const { marker, why } of FORBIDDEN) {
      if (src.includes(marker)) offenders.push(`${file.replace(ROOT + "/", "")} → ${marker} (${why})`);
    }
  }
  return offenders;
}

describe("migrated Super Admin routes contain no mock dependency", () => {
  for (const dir of MIGRATED_ROUTE_DIRS) {
    it(`${dir} is mock-free`, () => {
      const files = collectSources(dir);
      expect(files.length).toBeGreaterThan(0);
      const offenders = offendersIn(files);
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }

  for (const file of MIGRATED_FILES) {
    it(`${file} is mock-free`, () => {
      const offenders = offendersIn([join(ROOT, file)]);
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});
