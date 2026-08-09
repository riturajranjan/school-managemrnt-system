// Route classification + open-redirect guard (pure, no DB).
import { describe, expect, it } from "vitest";
import { isPublicPath, sanitizeReturnTo } from "@/lib/server/auth/routes";

describe("isPublicPath", () => {
  it("treats auth/error routes as public", () => {
    for (const p of ["/login", "/login/super-admin", "/forgot-password", "/reset-password", "/session-expired", "/verify-email"]) {
      expect(isPublicPath(p)).toBe(true);
    }
  });

  it("treats business + super-admin routes as protected", () => {
    for (const p of ["/", "/students", "/attendance", "/fees", "/library", "/settings", "/super-admin", "/super-admin/dashboard"]) {
      expect(isPublicPath(p)).toBe(false);
    }
  });
});

describe("sanitizeReturnTo (open-redirect guard)", () => {
  it("accepts safe internal paths", () => {
    expect(sanitizeReturnTo("/students")).toBe("/students");
    expect(sanitizeReturnTo("/super-admin/dashboard")).toBe("/super-admin/dashboard");
    expect(sanitizeReturnTo("/fees?tab=due")).toBe("/fees?tab=due");
  });

  it("rejects external and unsafe targets", () => {
    expect(sanitizeReturnTo("https://malicious.example")).toBeNull();
    expect(sanitizeReturnTo("http://evil.com/x")).toBeNull();
    expect(sanitizeReturnTo("//evil.com")).toBeNull(); // protocol-relative
    expect(sanitizeReturnTo("/\\evil.com")).toBeNull();
    expect(sanitizeReturnTo("/path\\with\\backslash")).toBeNull();
    expect(sanitizeReturnTo("javascript:alert(1)")).toBeNull();
    expect(sanitizeReturnTo("relative/path")).toBeNull();
    expect(sanitizeReturnTo("")).toBeNull();
    expect(sanitizeReturnTo(null)).toBeNull();
    expect(sanitizeReturnTo(undefined)).toBeNull();
  });

  it("rejects targets that would loop back to a public route", () => {
    expect(sanitizeReturnTo("/login")).toBeNull();
    expect(sanitizeReturnTo("/session-expired")).toBeNull();
  });

  it("rejects CRLF / control-char injection", () => {
    expect(sanitizeReturnTo("/ok\nSet-Cookie: x=y")).toBeNull();
    expect(sanitizeReturnTo("/ok\r\nheader")).toBeNull();
  });
});
