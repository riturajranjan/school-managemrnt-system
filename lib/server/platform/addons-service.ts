// Add-ons service (Super Admin Phase SA-4M).
//
// An Add-on is an optional commercial/product extension assigned to a school
// INDEPENDENTLY of its base Plan (distinct from a PlanFeature entitlement,
// SA-4L). Assignment = "this school is entitled to use this add-on"; the agreed
// commercial terms are SNAPSHOTTED at assignment. NO payment provider / gateway
// subscription / invoice / charge is created here — add-on invoicing is out of
// scope for this phase (documented). The tenant is always derived from the
// target School (never client-sent).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AddOnDto, SchoolAddOnDto } from "@/lib/api/contracts";
import { resolveSchoolTarget } from "./school-target";

export type AddOnActor = { id: string; name: string | null };

const STATUS_TO_DB = { draft: "DRAFT", active: "ACTIVE", archived: "ARCHIVED" } as const;
const STATUS_INTERVAL = { monthly: "MONTHLY", yearly: "YEARLY" } as const;
const dec = (v: Prisma.Decimal | null): number | null => (v == null ? null : Number(v));
const lower = (s: string | null): string | null => (s == null ? null : s.toLowerCase());

export const createSchema = z.object({
  code: z.string().trim().min(1).max(60).regex(/^[A-Za-z0-9_-]+$/, "Code: letters, digits, _ or - only"),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  category: z.string().trim().max(60).optional(),
  priceAmount: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  billingInterval: z.enum(["monthly", "yearly"]).nullable().optional(),
});

export const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  category: z.string().trim().max(60).nullable().optional(),
  priceAmount: z.number().nonnegative().nullable().optional(),
  currency: z.string().trim().length(3).optional(),
  billingInterval: z.enum(["monthly", "yearly"]).nullable().optional(),
});

type AddOnRow = {
  id: string; code: string; name: string; description: string | null; category: string | null;
  status: string; priceAmount: Prisma.Decimal | null; currency: string; billingInterval: string | null;
  createdAt: Date; updatedAt: Date; _count?: { assignments: number };
};

function toDto(a: AddOnRow, assignedSchoolCount?: number): AddOnDto {
  return {
    id: a.id, code: a.code, name: a.name, description: a.description, category: a.category,
    status: a.status.toLowerCase(),
    priceAmount: dec(a.priceAmount), currency: a.currency, billingInterval: lower(a.billingInterval),
    assignedSchoolCount: assignedSchoolCount ?? a._count?.assignments ?? 0,
    createdAt: a.createdAt.toISOString(), updatedAt: a.updatedAt.toISOString(),
  };
}

function auditScope(actor: AddOnActor, tenantId: string, schoolId: string | null): OrgScope {
  return { tenantId, schoolId: schoolId ?? "", branchId: null, academicSessionId: null, actor: { id: actor.id, name: actor.name } };
}

// ── Catalog ────────────────────────────────────────────────────────────────

/** List the add-on catalog with the count of schools that hold an ACTIVE assignment. */
export async function listAddOns(): Promise<AddOnDto[]> {
  const rows = await prisma.addOn.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } },
  });
  return rows.map((r) => toDto(r));
}

export async function getAddOn(id: string): Promise<AddOnDto> {
  const a = await prisma.addOn.findUnique({ where: { id }, include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } } });
  if (!a) throw new HttpError("NOT_FOUND", "Add-on not found");
  return toDto(a);
}

export async function createAddOn(actor: AddOnActor, raw: unknown): Promise<AddOnDto> {
  const input = parseInput(createSchema, raw);
  const clash = await prisma.addOn.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash) throw new HttpError("CONFLICT", "An add-on with this code already exists");

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.addOn.create({
      data: {
        code: input.code, name: input.name, description: input.description ?? null, category: input.category ?? null,
        status: "ACTIVE",
        priceAmount: input.priceAmount ?? null, currency: input.currency ?? "INR",
        billingInterval: input.billingInterval ? (STATUS_INTERVAL[input.billingInterval]) : null,
      },
    });
    // Catalog is platform-global; audit uses no tenant/school (platform scope "").
    await recordAudit(tx, auditScope(actor, "", null), "ADDON_CREATED", "AddOn", row.id, { code: row.code });
    return row;
  });
  return toDto({ ...created, _count: { assignments: 0 } });
}

export async function updateAddOn(actor: AddOnActor, id: string, raw: unknown): Promise<AddOnDto> {
  const input = parseInput(updateSchema, raw);
  const existing = await prisma.addOn.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Add-on not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.addOn.update({
      where: { id },
      data: {
        name: input.name,
        description: input.description === undefined ? undefined : input.description,
        category: input.category === undefined ? undefined : input.category,
        priceAmount: input.priceAmount === undefined ? undefined : input.priceAmount,
        currency: input.currency,
        billingInterval: input.billingInterval === undefined ? undefined : input.billingInterval ? STATUS_INTERVAL[input.billingInterval] : null,
      },
      include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } },
    });
    await recordAudit(tx, auditScope(actor, "", null), "ADDON_UPDATED", "AddOn", id);
    return row;
  });
  return toDto(updated);
}

export async function setAddOnStatus(actor: AddOnActor, id: string, status: "draft" | "active" | "archived"): Promise<AddOnDto> {
  const next = STATUS_TO_DB[status];
  const existing = await prisma.addOn.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Add-on not found");
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.addOn.update({
      where: { id },
      data: { status: next, archivedAt: next === "ARCHIVED" ? new Date() : null },
      include: { _count: { select: { assignments: { where: { status: "ACTIVE" } } } } },
    });
    await recordAudit(tx, auditScope(actor, "", null), "ADDON_STATUS_CHANGED", "AddOn", id, { from: existing.status, to: next });
    return row;
  });
  return toDto(updated);
}

// ── School assignment ────────────────────────────────────────────────────────

type SchoolAddOnRow = {
  id: string; status: string; startedAt: Date; endedAt: Date | null;
  priceAmount: Prisma.Decimal | null; currency: string | null; billingInterval: string | null;
  addOn: { id: string; code: string; name: string; category: string | null };
};

function assignmentDto(schoolId: string, a: SchoolAddOnRow): SchoolAddOnDto {
  return {
    id: a.id, schoolId,
    addOn: { id: a.addOn.id, code: a.addOn.code, name: a.addOn.name, category: a.addOn.category },
    status: a.status.toLowerCase(),
    startedAt: a.startedAt.toISOString(),
    endedAt: a.endedAt ? a.endedAt.toISOString() : null,
    priceAmount: dec(a.priceAmount), currency: a.currency, billingInterval: lower(a.billingInterval),
  };
}

const assignmentSelect = {
  id: true, status: true, startedAt: true, endedAt: true, priceAmount: true, currency: true, billingInterval: true,
  addOn: { select: { id: true, code: true, name: true, category: true } },
} as const;

/** A school's add-on assignments (ACTIVE first, newest first). */
export async function listSchoolAddOns(schoolId: string): Promise<SchoolAddOnDto[]> {
  await resolveSchoolTarget(schoolId); // 404 for unknown school
  const rows = await prisma.schoolAddOn.findMany({ where: { schoolId }, select: assignmentSelect, orderBy: [{ status: "asc" }, { startedAt: "desc" }] });
  return rows.map((r) => assignmentDto(schoolId, r));
}

/**
 * Assign an add-on to a school (idempotent per (school, add-on): reactivates an
 * ENDED row, refusing to duplicate an ACTIVE one). Snapshots the catalog's
 * commercial terms. The add-on must be an ACTIVE catalog entry.
 */
export async function assignAddOn(actor: AddOnActor, schoolId: string, addOnId: string): Promise<SchoolAddOnDto> {
  const target = await resolveSchoolTarget(schoolId);
  const addOn = await prisma.addOn.findUnique({ where: { id: addOnId }, select: { id: true, status: true, priceAmount: true, currency: true, billingInterval: true } });
  if (!addOn) throw new HttpError("NOT_FOUND", "Add-on not found");
  if (addOn.status !== "ACTIVE") throw new HttpError("CONFLICT", "Only an ACTIVE add-on can be assigned");

  const existing = await prisma.schoolAddOn.findUnique({ where: { schoolId_addOnId: { schoolId, addOnId } }, select: { id: true, status: true } });
  if (existing?.status === "ACTIVE") throw new HttpError("CONFLICT", "This add-on is already assigned to the school");

  const row = await prisma.$transaction(async (tx) => {
    const saved = existing
      ? await tx.schoolAddOn.update({
          where: { id: existing.id },
          data: { status: "ACTIVE", startedAt: new Date(), endedAt: null, priceAmount: addOn.priceAmount, currency: addOn.currency, billingInterval: addOn.billingInterval },
          select: assignmentSelect,
        })
      : await tx.schoolAddOn.create({
          data: { tenantId: target.tenantId, schoolId, addOnId, status: "ACTIVE", priceAmount: addOn.priceAmount, currency: addOn.currency, billingInterval: addOn.billingInterval },
          select: assignmentSelect,
        });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "ADDON_ASSIGNED", "SchoolAddOn", saved.id, { addOnId });
    return saved;
  });
  return assignmentDto(schoolId, row);
}

/** End a school's add-on assignment (status ENDED). Idempotent. */
export async function removeSchoolAddOn(actor: AddOnActor, schoolId: string, assignmentId: string): Promise<SchoolAddOnDto> {
  const target = await resolveSchoolTarget(schoolId);
  const existing = await prisma.schoolAddOn.findFirst({ where: { id: assignmentId, schoolId }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Assignment not found");
  const row = await prisma.$transaction(async (tx) => {
    const saved = await tx.schoolAddOn.update({ where: { id: assignmentId }, data: { status: "ENDED", endedAt: new Date() }, select: assignmentSelect });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "ADDON_REMOVED", "SchoolAddOn", assignmentId);
    return saved;
  });
  return assignmentDto(schoolId, row);
}

// ── Entitlement resolver (foundation) ────────────────────────────────────────

/** Is a school entitled to an add-on (by code)? The enforcement primitive. */
export async function hasAddOn(schoolId: string, addOnCode: string): Promise<boolean> {
  const row = await prisma.schoolAddOn.findFirst({
    where: { schoolId, status: "ACTIVE", addOn: { code: addOnCode } },
    select: { id: true },
  });
  return row != null;
}
