// Pure state-machine test (no DB, no DOM) for the platform-admin gate — see
// app/super-admin/layout.tsx. Covers items D/E of the first-login race audit:
// a permission check must distinguish "still loading" from "confirmed denied."
import { describe, expect, it } from "vitest";
import { resolvePlatformAdminGate } from "@/lib/permissions/auth-gate";

describe("resolvePlatformAdminGate", () => {
  it("is LOADING while capabilities are still resolving, regardless of the (not-yet-real) isPlatformAdmin value", () => {
    expect(resolvePlatformAdminGate({ capabilitiesLoading: true, isPlatformAdmin: false })).toBe("LOADING");
    // Even if some transient state briefly reports isPlatformAdmin true while
    // still loading, LOADING wins — never treated as a green light early.
    expect(resolvePlatformAdminGate({ capabilitiesLoading: true, isPlatformAdmin: true })).toBe("LOADING");
  });

  it("is ALLOWED only once loading has finished AND the account is a real platform admin", () => {
    expect(resolvePlatformAdminGate({ capabilitiesLoading: false, isPlatformAdmin: true })).toBe("ALLOWED");
  });

  it("is DENIED only once loading has finished and the account is confirmed not a platform admin — never before", () => {
    expect(resolvePlatformAdminGate({ capabilitiesLoading: false, isPlatformAdmin: false })).toBe("DENIED");
  });
});
