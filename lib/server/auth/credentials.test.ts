import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  signInEmail: vi.fn(),
  userFindUnique: vi.fn(),
  userUpdate: vi.fn(),
  sessionDeleteMany: vi.fn(),
  platformAdminFindUnique: vi.fn(),
  tenantMembershipFindFirst: vi.fn(),
  recordAudit: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/auth", () => ({ auth: { api: { signInEmail: mocks.signInEmail } } }));
vi.mock("@/lib/server/audit", () => ({ recordAudit: mocks.recordAudit }));
vi.mock("@/lib/db/prisma", () => ({
  prisma: {
    user: { findUnique: mocks.userFindUnique, update: mocks.userUpdate },
    session: { deleteMany: mocks.sessionDeleteMany },
    platformAdmin: { findUnique: mocks.platformAdminFindUnique },
    tenantMembership: { findFirst: mocks.tenantMembershipFindFirst },
  },
}));

import { authenticateCredentials, credentialsLoginSchema, resolveSimplePostLoginDestination } from "./credentials";

function headers() {
  return new Headers();
}

describe("credentialsLoginSchema", () => {
  it("normalizes email and rejects non-email identifiers", () => {
    expect(credentialsLoginSchema.safeParse({ identifier: " USER@NOVYRA.IO ", password: "x" }).success).toBe(true);
    expect(credentialsLoginSchema.safeParse({ identifier: "teacher-1", password: "x" }).success).toBe(false);
  });
});

describe("resolveSimplePostLoginDestination", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("routes platform admins to the platform dashboard", async () => {
    mocks.platformAdminFindUnique.mockResolvedValue({ status: "ACTIVE" });
    await expect(resolveSimplePostLoginDestination("user-1")).resolves.toBe("/super-admin/dashboard");
  });

  it("routes seeded tenant roles to safe existing pages", async () => {
    mocks.platformAdminFindUnique.mockResolvedValue(null);
    mocks.tenantMembershipFindFirst.mockResolvedValue({ roleAssignments: [{ role: { key: "TEACHER" } }] });
    await expect(resolveSimplePostLoginDestination("user-1")).resolves.toBe("/teacher/my-day");
  });
});

describe("authenticateCredentials", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.userUpdate.mockResolvedValue({});
    mocks.sessionDeleteMany.mockResolvedValue({ count: 0 });
    mocks.recordAudit.mockResolvedValue(undefined);
    mocks.platformAdminFindUnique.mockResolvedValue(null);
    mocks.tenantMembershipFindFirst.mockResolvedValue({ roleAssignments: [{ role: { key: "SCHOOL_ADMIN" } }] });
  });

  it("returns a safe invalid-credentials result for malformed input", async () => {
    const result = await authenticateCredentials({ identifier: "nope", password: "pw", headers: headers() });
    expect(result).toEqual({ success: false, errorCode: "INVALID_CREDENTIALS" });
    expect(mocks.signInEmail).not.toHaveBeenCalled();
  });

  it("does not reveal unknown users or wrong passwords", async () => {
    mocks.signInEmail.mockRejectedValue({ name: "APIError" });
    const result = await authenticateCredentials({ identifier: "missing@novyra.io", password: "wrong", headers: headers() });
    expect(result).toEqual({ success: false, errorCode: "INVALID_CREDENTIALS" });
    expect(mocks.recordAudit).toHaveBeenCalledWith(expect.objectContaining({ action: "auth.login.failure" }));
  });

  it("maps auth-time database outages to a safe unavailable error", async () => {
    mocks.signInEmail.mockRejectedValue({ code: "P1001", message: "Can't reach database server" });
    const result = await authenticateCredentials({ identifier: "kavya@novyra.edu.in", password: "pw", headers: headers() });
    expect(result).toEqual({ success: false, errorCode: "DATABASE_UNAVAILABLE" });
  });

  it("creates a real auth session through Better Auth and returns a safe redirect", async () => {
    mocks.signInEmail.mockResolvedValue({ user: { id: "user-1" } });
    mocks.userFindUnique.mockResolvedValue({ status: "ACTIVE" });
    const result = await authenticateCredentials({ identifier: "kavya@novyra.edu.in", password: "Novyra@Dev123", headers: headers(), next: "/fees" });
    expect(mocks.signInEmail).toHaveBeenCalledWith({
      body: { email: "kavya@novyra.edu.in", password: "Novyra@Dev123" },
      headers: expect.any(Headers),
    });
    expect(result).toEqual({ success: true, userId: "user-1", redirectTo: "/fees" });
  });

  it("revokes the session side effect for restricted accounts", async () => {
    mocks.signInEmail.mockResolvedValue({ user: { id: "user-1" } });
    mocks.userFindUnique.mockResolvedValue({ status: "SUSPENDED" });
    const result = await authenticateCredentials({ identifier: "blocked@novyra.edu.in", password: "pw", headers: headers() });
    expect(result).toEqual({ success: false, errorCode: "ACCOUNT_RESTRICTED" });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });

  it("fails safely when the database is unavailable after auth", async () => {
    mocks.signInEmail.mockResolvedValue({ user: { id: "user-1" } });
    mocks.userFindUnique.mockRejectedValue(new Error("db unavailable"));
    const result = await authenticateCredentials({ identifier: "kavya@novyra.edu.in", password: "pw", headers: headers() });
    expect(result).toEqual({ success: false, errorCode: "DATABASE_UNAVAILABLE" });
    expect(mocks.sessionDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1" } });
  });
});
