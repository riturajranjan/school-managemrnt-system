// DAL platform-admin gate (Super Admin SA-1). Verifies the SERVER-SIDE redirect
// behavior for /super-admin/*: unauthenticated → /login, authenticated non-
// platform user → /access-denied, real platform admin → allowed. `redirect()`
// and the session lookup are mocked so this stays a pure unit test.
import { beforeEach, describe, expect, it, vi } from "vitest";

const redirectMock = vi.fn((path: string) => {
  throw new Error(`REDIRECT:${path}`);
});
vi.mock("next/navigation", () => ({ redirect: (p: string) => redirectMock(p) }));

const getCurrentUserMock = vi.fn();
vi.mock("./current-user", () => ({ getCurrentUser: () => getCurrentUserMock() }));

const { requireUser, requirePlatformAdmin } = await import("./dal");

function user(isPlatformAdmin: boolean) {
  return { id: "u1", name: "Test", email: "t@example.com", image: null, status: "ACTIVE", isPlatformAdmin };
}

describe("DAL auth gate", () => {
  beforeEach(() => {
    redirectMock.mockClear();
    getCurrentUserMock.mockReset();
  });

  it("requireUser redirects to /login when unauthenticated", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    await expect(requireUser()).rejects.toThrow("REDIRECT:/login");
  });

  it("requirePlatformAdmin redirects unauthenticated → /login", async () => {
    getCurrentUserMock.mockResolvedValue(null);
    await expect(requirePlatformAdmin()).rejects.toThrow("REDIRECT:/login");
  });

  it("requirePlatformAdmin redirects an authenticated non-platform user → /access-denied", async () => {
    getCurrentUserMock.mockResolvedValue(user(false));
    await expect(requirePlatformAdmin()).rejects.toThrow("REDIRECT:/access-denied");
  });

  it("requirePlatformAdmin allows a real platform admin", async () => {
    getCurrentUserMock.mockResolvedValue(user(true));
    const result = await requirePlatformAdmin();
    expect(result.isPlatformAdmin).toBe(true);
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
