// Permission resolver against the real seed (Backend Phase 3). Uses the seeded
// users' active roles. Read-only; skips if DB unreachable/unseeded.
import { describe, expect, it } from "vitest";
import { prisma } from "@/lib/db/prisma";
import { resolveUserAuthz } from "@/lib/server/authz/permissions";
import { setRole } from "@/lib/server/context/service";

let dbReady = false;
try {
  const admin = await prisma.user.findUnique({ where: { email: "admin@novyra-demo.example" } });
  dbReady = Boolean(admin);
} catch {
  dbReady = false;
}

async function permsFor(email: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { email },
    select: { id: true, platformAdmin: { select: { id: true } } },
  });
  const ctx = await resolveUserAuthz(user.id, Boolean(user.platformAdmin));
  return { userId: user.id, ctx };
}

describe.skipIf(!dbReady)("permission resolver (DB)", () => {
  it("resolves SCHOOL_ADMIN to broad permissions incl. settings.manage", async () => {
    // Admin has a single assigned role (SCHOOL_ADMIN), so its permissions resolve
    // whether or not an active role is explicitly selected.
    const { ctx } = await permsFor("admin@novyra-demo.example");
    expect(ctx.permissions.has("settings.manage")).toBe(true);
    expect(ctx.permissions.has("students.create")).toBe(true);
    expect(ctx.permissions.has("fees.collect")).toBe(true);
    expect(ctx.permissions.has("super_admin.access")).toBe(false); // never platform
  });

  it("resolves TEACHER to a limited set (has attendance.mark, lacks settings.view)", async () => {
    const { ctx } = await permsFor("teacher@novyra-demo.example");
    expect(ctx.permissions.has("attendance.mark")).toBe(true);
    expect(ctx.permissions.has("students.view")).toBe(true);
    expect(ctx.permissions.has("settings.view")).toBe(false);
    expect(ctx.permissions.has("students.create")).toBe(false);
  });

  it("resolves LIBRARIAN to library permissions only (no HR/finance)", async () => {
    const { ctx } = await permsFor("librarian@novyra-demo.example");
    expect(ctx.permissions.has("library.manage")).toBe(true);
    expect(ctx.permissions.has("hr.manage")).toBe(false);
    expect(ctx.permissions.has("fees.collect")).toBe(false);
  });

  it("platform admin gets super_admin.access but NO tenant role permissions", async () => {
    const { ctx } = await permsFor("platform.admin@novyra.example");
    expect(ctx.isPlatformAdmin).toBe(true);
    expect(ctx.permissions.has("super_admin.access")).toBe(true);
    expect(ctx.permissions.has("students.create")).toBe(false);
  });

  it("selecting an unassigned role does not grant its permissions (tenant isolation)", async () => {
    // Teacher cannot become SCHOOL_ADMIN by pointing UserActiveContext at that role id.
    const teacher = await prisma.user.findUniqueOrThrow({ where: { email: "teacher@novyra-demo.example" }, select: { id: true } });
    const adminRole = await prisma.role.findFirstOrThrow({ where: { key: "SCHOOL_ADMIN", isSystem: true } });
    // setRole rejects an unassigned role...
    await expect(setRole(teacher.id, adminRole.id)).rejects.toHaveProperty("code", "INVALID_ROLE");
    // ...and even a directly-written stale roleId is ignored by the resolver.
    await prisma.userActiveContext.upsert({
      where: { userId: teacher.id },
      update: { roleId: adminRole.id },
      create: { userId: teacher.id, roleId: adminRole.id },
    });
    const ctx = await resolveUserAuthz(teacher.id, false);
    expect(ctx.activeRoleKey).not.toBe("SCHOOL_ADMIN");
    expect(ctx.permissions.has("settings.manage")).toBe(false);
    // cleanup — remove the temp context row.
    await prisma.userActiveContext.deleteMany({ where: { userId: teacher.id } });
  });
});
