import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

describe("safeNext (open-redirect protection)", () => {
  const fallback = "/";

  it("allows a normal same-origin path", () => {
    expect(safeNext("/students", fallback)).toBe("/students");
    expect(safeNext("/fees/collect?tab=due", fallback)).toBe("/fees/collect?tab=due");
  });

  it("falls back for external absolute URLs", () => {
    expect(safeNext("https://evil.com", fallback)).toBe(fallback);
    expect(safeNext("http://evil.com/path", fallback)).toBe(fallback);
  });

  it("rejects protocol-relative and backslash tricks", () => {
    expect(safeNext("//evil.com", fallback)).toBe(fallback);
    expect(safeNext("/\\evil.com", fallback)).toBe(fallback);
    expect(safeNext("/path\\..\\evil", fallback)).toBe(fallback);
  });

  it("rejects non-path / empty values", () => {
    expect(safeNext("javascript:alert(1)", fallback)).toBe(fallback);
    expect(safeNext("evil.com", fallback)).toBe(fallback);
    expect(safeNext("", fallback)).toBe(fallback);
    expect(safeNext(null, fallback)).toBe(fallback);
    expect(safeNext(undefined, fallback)).toBe(fallback);
  });

  it("does not bounce back into a public/auth route", () => {
    expect(safeNext("/login", fallback)).toBe(fallback);
    expect(safeNext("/select-school", fallback)).toBe(fallback);
    expect(safeNext("/reset-password?token=x", fallback)).toBe(fallback);
  });
});
