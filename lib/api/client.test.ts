// Regression coverage for the first-login permission-denied race condition.
// Root cause: apiGet's in-flight GET dedup is keyed by URL only, with no
// concept of identity. Right after login, an auth-sensitive re-fetch (see
// PermissionsProvider.refreshCapabilities) could be silently satisfied by an
// EARLIER request for the same URL that was still in flight from BEFORE
// login (e.g. the anonymous /login page's own mount-time capabilities
// fetch) — applying stale pre-login data even though the caller explicitly
// asked for a fresh read. `force: true` must always issue (and hand back)
// a genuinely new request, while every other caller keeps sharing one
// in-flight request per URL (pure, no DB — mocks global fetch).
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiGet } from "@/lib/api/client";

function deferredResponse() {
  let resolve!: (data: unknown) => void;
  const promise = new Promise<Response>((res) => {
    resolve = (data: unknown) => res({ json: async () => data } as Response);
  });
  return { promise, resolve };
}

describe("apiGet", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("dedupes concurrent GETs to the same URL into a single network call", async () => {
    const first = deferredResponse();
    fetchMock.mockReturnValueOnce(first.promise);

    const p1 = apiGet("/api/x");
    const p2 = apiGet("/api/x");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    first.resolve({ success: true, data: "A" });
    const [r1, r2] = await Promise.all([p1, p2]);
    expect(r1).toEqual({ success: true, data: "A" });
    expect(r2).toEqual({ success: true, data: "A" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("force:true issues a genuinely fresh request even while an earlier request for the same URL is still in flight, and never resolves with the stale result — the exact login-race scenario", async () => {
    const stale = deferredResponse(); // e.g. the anonymous /login page's own mount-time fetch
    const fresh = deferredResponse(); // e.g. refreshCapabilities() called right after login
    fetchMock.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);

    const stalePromise = apiGet("/api/auth/capabilities"); // still pending
    const freshPromise = apiGet("/api/auth/capabilities", { force: true }); // login just succeeded

    expect(fetchMock).toHaveBeenCalledTimes(2); // force must not reuse the pending request

    // Resolve out of order: the stale (pre-login) request finishes AFTER the
    // fresh (post-login) one. The forced caller must still get its own,
    // correct result — never the stale one.
    fresh.resolve({ success: true, data: { isPlatformAdmin: true } });
    stale.resolve({ success: false, error: { code: "UNAUTHENTICATED", message: "Sign in required" } });

    const [staleResult, freshResult] = await Promise.all([stalePromise, freshPromise]);
    expect(staleResult).toEqual({ success: false, error: { code: "UNAUTHENTICATED", message: "Sign in required" } });
    expect(freshResult).toEqual({ success: true, data: { isPlatformAdmin: true } });
  });

  it("after a forced call, a later normal (non-forced) call for the same URL dedupes against it while it's in flight", async () => {
    const forced = deferredResponse();
    fetchMock.mockReturnValueOnce(forced.promise);

    const forcedPromise = apiGet("/api/x", { force: true });
    const laterPromise = apiGet("/api/x"); // arrives while the forced call is still outstanding
    expect(fetchMock).toHaveBeenCalledTimes(1); // shares the forced call, doesn't start a third

    forced.resolve({ success: true, data: "B" });
    const [forcedResult, laterResult] = await Promise.all([forcedPromise, laterPromise]);
    expect(forcedResult).toEqual({ success: true, data: "B" });
    expect(laterResult).toEqual({ success: true, data: "B" });
  });

  it("a brand-new GET after the in-flight one has settled issues its own fresh network call", async () => {
    const first = deferredResponse();
    fetchMock.mockReturnValueOnce(first.promise);
    const p1 = apiGet("/api/x");
    first.resolve({ success: true, data: "A" });
    await p1;

    const second = deferredResponse();
    fetchMock.mockReturnValueOnce(second.promise);
    const p2 = apiGet("/api/x");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    second.resolve({ success: true, data: "C" });
    expect(await p2).toEqual({ success: true, data: "C" });
  });
});
