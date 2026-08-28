// Demo Access must never be offered in production (pure, no DB).
import { describe, expect, it } from "vitest";
import { isDemoAccessEnabled } from "@/lib/types/auth";

describe("isDemoAccessEnabled", () => {
  it("is disabled in production", () => {
    expect(isDemoAccessEnabled("production")).toBe(false);
  });

  it("is enabled in development and test, and when NODE_ENV is unset", () => {
    expect(isDemoAccessEnabled("development")).toBe(true);
    expect(isDemoAccessEnabled("test")).toBe(true);
    expect(isDemoAccessEnabled(undefined)).toBe(true);
  });
});
