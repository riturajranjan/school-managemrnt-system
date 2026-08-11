// Impersonation mock/authority guard (Super Admin SA-4K). Server-authoritative
// impersonation must NEVER derive authority from the frontend mock store or from
// browser storage. If any impersonation source file imports db.saas / the mock
// SaaS service or selectors / the mock store hook, or reads localStorage /
// sessionStorage, this test fails. (Client STATE comes only from the server via
// /api/auth/capabilities and the /api/super-admin/impersonation endpoints.)
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();

const IMPERSONATION_FILES = [
  "components/shell/impersonation-banner.tsx",
  "lib/hooks/api/use-impersonation.ts",
  "lib/server/platform/impersonation-service.ts",
  "lib/server/auth/impersonation.ts",
  "app/api/super-admin/impersonation/route.ts",
  "app/api/super-admin/impersonation/start/route.ts",
  "app/api/super-admin/impersonation/stop/route.ts",
  "app/super-admin/schools/[schoolId]/page.tsx",
];

// Storage markers match real ACCESS (`localStorage.getItem`, `sessionStorage[`)
// — a trailing `.` or `[` — so prose in comments ("never reads localStorage")
// does not trip the guard, only actual usage does.
const FORBIDDEN: { marker: string; why: string }[] = [
  { marker: "db.saas", why: "mock SaaS store slice (incl. db.saas.tenants)" },
  { marker: "services/saas-service", why: "mock SaaS service" },
  { marker: "selectors/saas-brief", why: "mock SaaS selectors" },
  { marker: "useSisStore", why: "mock store hook" },
  { marker: "hooks/use-store", why: "mock store hook" },
  { marker: "localStorage.", why: "client storage can never be an impersonation authority" },
  { marker: "localStorage[", why: "client storage can never be an impersonation authority" },
  { marker: "sessionStorage.", why: "client storage can never be an impersonation authority" },
  { marker: "sessionStorage[", why: "client storage can never be an impersonation authority" },
];

describe("impersonation carries no mock/browser-storage authority", () => {
  for (const rel of IMPERSONATION_FILES) {
    it(`${rel} is free of mock/storage authority`, () => {
      const src = readFileSync(join(ROOT, rel), "utf8");
      const offenders = FORBIDDEN.filter(({ marker }) => src.includes(marker)).map(({ marker, why }) => `${marker} (${why})`);
      expect(offenders, offenders.join("\n")).toEqual([]);
    });
  }
});
