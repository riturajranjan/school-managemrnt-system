// Platform administrators service (Super Admin Phase SA-4N).
//
// Manages the EXISTING PlatformAdmin/User models — NOT a second auth/identity
// system. Invites reuse the invited-user architecture (status INVITED +
// passwordSetupRequired); no email is sent, so the UI shows "Invitation pending"
// honestly. Server-side invariants protect the last active SUPER_ADMIN.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { PlatformAdminDto } from "@/lib/api/contracts";
import { platformScope, type PlatformActor } from "./platform-audit";

const ROLES = ["SUPER_ADMIN", "SUPPORT", "BILLING", "AUDITOR"] as const;

export const inviteSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().email().max(320),
  role: z.enum(ROLES),
});
export const updateSchema = z.object({ role: z.enum(ROLES).optional() });

type AdminRow = {
  id: string; role: string; status: string; createdAt: Date; updatedAt: Date;
  user: { id: string; name: string | null; email: string; status: string; passwordSetupRequired: boolean };
};

function toDto(a: AdminRow): PlatformAdminDto {
  return {
    id: a.id, userId: a.user.id, name: a.user.name, email: a.user.email,
    role: a.role, status: a.status.toLowerCase(),
    invitePending: a.user.passwordSetupRequired || a.user.status === "INVITED",
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

const include = { user: { select: { id: true, name: true, email: true, status: true, passwordSetupRequired: true } } } as const;

/** Count platform admins who can currently act as SUPER_ADMIN (status ACTIVE). */
async function activeSuperAdminCount(tx = prisma): Promise<number> {
  return tx.platformAdmin.count({ where: { role: "SUPER_ADMIN", status: "ACTIVE" } });
}

export async function listAdmins(params: { search?: string; role?: string; status?: string }): Promise<PlatformAdminDto[]> {
  const where: Record<string, unknown> = {};
  if (params.role && (ROLES as readonly string[]).includes(params.role)) where.role = params.role;
  if (params.status) where.status = params.status.toUpperCase();
  if (params.search) {
    const q = params.search.trim();
    where.user = { OR: [{ name: { contains: q, mode: "insensitive" } }, { email: { contains: q, mode: "insensitive" } }] };
  }
  const rows = await prisma.platformAdmin.findMany({ where, include, orderBy: { createdAt: "asc" } });
  return rows.map(toDto);
}

export async function getAdmin(id: string): Promise<PlatformAdminDto> {
  const a = await prisma.platformAdmin.findUnique({ where: { id }, include });
  if (!a) throw new HttpError("NOT_FOUND", "Platform admin not found");
  return toDto(a);
}

/** Invite a platform admin: create (or reuse) an INVITED user + a PlatformAdmin row. */
export async function inviteAdmin(actor: PlatformActor, raw: unknown): Promise<PlatformAdminDto> {
  const input = parseInput(inviteSchema, raw);
  const email = input.email.toLowerCase();

  const created = await prisma.$transaction(async (tx) => {
    let user = await tx.user.findUnique({ where: { email }, select: { id: true } });
    if (user) {
      const already = await tx.platformAdmin.findUnique({ where: { userId: user.id }, select: { id: true } });
      if (already) throw new HttpError("CONFLICT", "This user is already a platform admin");
    } else {
      user = await tx.user.create({ data: { email, name: input.name, status: "INVITED", passwordSetupRequired: true }, select: { id: true } });
    }
    const admin = await tx.platformAdmin.create({ data: { userId: user.id, role: input.role, status: "ACTIVE" }, include });
    await recordAudit(tx, platformScope(actor), "PLATFORM_ADMIN_INVITED", "PlatformAdmin", admin.id, { email, role: input.role });
    return admin;
  });
  return toDto(created);
}

/** Update an admin's role, protecting the last active SUPER_ADMIN from demotion. */
export async function updateAdmin(actor: PlatformActor, id: string, raw: unknown): Promise<PlatformAdminDto> {
  const input = parseInput(updateSchema, raw);
  const existing = await prisma.platformAdmin.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Platform admin not found");

  if (input.role && input.role !== "SUPER_ADMIN" && existing.role === "SUPER_ADMIN" && existing.status === "ACTIVE") {
    if ((await activeSuperAdminCount()) <= 1) throw new HttpError("CONFLICT", "Cannot demote the last active super admin");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.platformAdmin.update({ where: { id }, data: { role: input.role }, include });
    await recordAudit(tx, platformScope(actor), "PLATFORM_ADMIN_UPDATED", "PlatformAdmin", id, { role: input.role });
    return row;
  });
  return toDto(updated);
}

/** Activate/suspend an admin, protecting the last active SUPER_ADMIN. */
export async function setAdminStatus(actor: PlatformActor, id: string, status: "active" | "suspended"): Promise<PlatformAdminDto> {
  const next = status === "active" ? "ACTIVE" : "SUSPENDED";
  const existing = await prisma.platformAdmin.findUnique({ where: { id }, select: { id: true, role: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Platform admin not found");

  if (next !== "ACTIVE" && existing.role === "SUPER_ADMIN" && existing.status === "ACTIVE") {
    if ((await activeSuperAdminCount()) <= 1) throw new HttpError("CONFLICT", "Cannot suspend the last active super admin");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.platformAdmin.update({ where: { id }, data: { status: next }, include });
    await recordAudit(tx, platformScope(actor), "PLATFORM_ADMIN_STATUS_CHANGED", "PlatformAdmin", id, { from: existing.status, to: next });
    return row;
  });
  return toDto(updated);
}
