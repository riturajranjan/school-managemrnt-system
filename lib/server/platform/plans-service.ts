// Platform (Super Admin) plan catalog service (Phase SA-4A). Platform-global —
// gated by platform.plans.{view,manage} in the routes. Monetary values are stored
// structured (Decimal price + ISO currency); the client formats them. Plans are
// archived (status change), never hard-deleted, so future subscriptions stay
// historically valid.
//
// Note: the shared AuditEvent model is tenant-scoped (tenantId required), so plan
// actions (which have no tenant) are not written to it in SA-4A.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import type { ListMeta } from "@/lib/server/api/response";
import { billingIntervalFromUi, billingIntervalToUi, planStatusFromUi, planStatusToUi } from "@/lib/server/api/enums";
import type { Prisma } from "@/lib/generated/prisma/client";

// --- Validation -------------------------------------------------------------

const nonEmpty = z.string().trim().min(1);
const optionalStr = z.string().trim().min(1).optional();
const nonNegInt = z.number().int().min(0);
const billingUi = z.enum(["monthly", "yearly"]);

const limitsSchema = z
  .object({
    maxStudents: nonNegInt.nullable().optional(),
    maxStaff: nonNegInt.nullable().optional(),
    maxBranches: nonNegInt.nullable().optional(),
    storageGb: nonNegInt.nullable().optional(),
  })
  .optional();

export const planCreateSchema = z.object({
  code: nonEmpty.max(60).transform((c) => c.toUpperCase()),
  name: nonEmpty.max(120),
  description: optionalStr,
  currency: z.string().trim().length(3).toUpperCase().default("INR"),
  price: z.number().min(0, "Price cannot be negative"),
  billingInterval: billingUi.default("monthly"),
  trialDays: nonNegInt.default(0),
  isPublic: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  status: z.enum(["draft", "active", "archived"]).default("draft"),
  supportLevel: optionalStr,
  whiteLabel: z.boolean().default(false),
  limits: limitsSchema,
  features: z.array(z.string().trim().min(1)).default([]),
});

export const planUpdateSchema = z
  .object({
    name: nonEmpty.max(120),
    description: optionalStr,
    currency: z.string().trim().length(3).toUpperCase(),
    price: z.number().min(0, "Price cannot be negative"),
    billingInterval: billingUi,
    trialDays: nonNegInt,
    isPublic: z.boolean(),
    sortOrder: z.number().int(),
    supportLevel: optionalStr,
    whiteLabel: z.boolean(),
    limits: limitsSchema,
    features: z.array(z.string().trim().min(1)),
  })
  .partial();

export const planStatusSchema = z.object({ status: z.enum(["draft", "active", "archived"]) });

// --- Serializer -------------------------------------------------------------

type PlanRow = Prisma.PlanGetPayload<{ include: { features: { select: { key: true } } } }>;

function serialize(p: PlanRow) {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    status: planStatusToUi[p.status],
    billingInterval: billingIntervalToUi[p.billingInterval],
    currency: p.currency,
    price: Number(p.price),
    trialDays: p.trialDays,
    isPublic: p.isPublic,
    sortOrder: p.sortOrder,
    limits: {
      maxStudents: p.maxStudents,
      maxStaff: p.maxStaff,
      maxBranches: p.maxBranches,
      storageGb: p.storageGb,
    },
    supportLevel: p.supportLevel,
    whiteLabel: p.whiteLabel,
    features: p.features.map((f) => f.key),
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    archivedAt: p.archivedAt?.toISOString() ?? null,
  };
}

const includeFeatures = { features: { select: { key: true } } } as const;

// --- Reads ------------------------------------------------------------------

export type PlanListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  billingInterval?: string;
  sort?: "sortOrder" | "price" | "name" | "createdAt";
  order?: "asc" | "desc";
};

export async function listPlans(params: PlanListParams) {
  const where: Prisma.PlanWhereInput = {};
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { code: { contains: q, mode: "insensitive" } },
    ];
  }
  if (params.status && planStatusFromUi[params.status]) where.status = planStatusFromUi[params.status];
  if (params.billingInterval && billingIntervalFromUi[params.billingInterval]) where.billingInterval = billingIntervalFromUi[params.billingInterval];

  const order = params.order ?? "asc";
  let orderBy: Prisma.PlanOrderByWithRelationInput;
  switch (params.sort) {
    case "price":
      orderBy = { price: order };
      break;
    case "name":
      orderBy = { name: order };
      break;
    case "createdAt":
      orderBy = { createdAt: order };
      break;
    default:
      orderBy = { sortOrder: order };
  }

  const [total, rows] = await Promise.all([
    prisma.plan.count({ where }),
    prisma.plan.findMany({ where, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: includeFeatures }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map(serialize), meta };
}

export async function getPlan(planId: string) {
  const plan = await prisma.plan.findUnique({ where: { id: planId }, include: includeFeatures });
  if (!plan) throw new HttpError("NOT_FOUND", "Plan not found");
  return serialize(plan);
}

// --- Writes -----------------------------------------------------------------

type LimitsInput = z.infer<typeof limitsSchema>;
function limitsData(limits: LimitsInput) {
  return {
    maxStudents: limits?.maxStudents ?? null,
    maxStaff: limits?.maxStaff ?? null,
    maxBranches: limits?.maxBranches ?? null,
    storageGb: limits?.storageGb ?? null,
  };
}

export async function createPlan(raw: unknown) {
  const input = parseInput(planCreateSchema, raw);
  const clash = await prisma.plan.findUnique({ where: { code: input.code }, select: { id: true } });
  if (clash) throw new HttpError("PLAN_CODE_EXISTS", "A plan with this code already exists");

  const uniqueFeatures = [...new Set(input.features)];
  const created = await prisma.plan.create({
    data: {
      code: input.code,
      name: input.name,
      description: input.description ?? null,
      currency: input.currency,
      price: input.price,
      billingInterval: billingIntervalFromUi[input.billingInterval],
      trialDays: input.trialDays,
      isPublic: input.isPublic,
      sortOrder: input.sortOrder,
      status: planStatusFromUi[input.status],
      supportLevel: input.supportLevel ?? null,
      whiteLabel: input.whiteLabel,
      ...limitsData(input.limits),
      features: { create: uniqueFeatures.map((key) => ({ key })) },
    },
    include: includeFeatures,
  });
  return serialize(created);
}

export async function updatePlan(planId: string, raw: unknown) {
  const input = parseInput(planUpdateSchema, raw);
  const existing = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Plan not found");

  const data: Prisma.PlanUpdateInput = {};
  const set = (k: string, v: unknown) => {
    (data as Record<string, unknown>)[k] = v;
  };
  if (input.name !== undefined) set("name", input.name);
  if (input.description !== undefined) set("description", input.description ?? null);
  if (input.currency !== undefined) set("currency", input.currency);
  if (input.price !== undefined) set("price", input.price);
  if (input.billingInterval !== undefined) set("billingInterval", billingIntervalFromUi[input.billingInterval]);
  if (input.trialDays !== undefined) set("trialDays", input.trialDays);
  if (input.isPublic !== undefined) set("isPublic", input.isPublic);
  if (input.sortOrder !== undefined) set("sortOrder", input.sortOrder);
  if (input.supportLevel !== undefined) set("supportLevel", input.supportLevel ?? null);
  if (input.whiteLabel !== undefined) set("whiteLabel", input.whiteLabel);
  if (input.limits !== undefined) Object.assign(data, limitsData(input.limits));

  return prisma.$transaction(async (tx) => {
    await tx.plan.update({ where: { id: planId }, data });
    if (input.features !== undefined) {
      const uniqueFeatures = [...new Set(input.features)];
      await tx.planFeature.deleteMany({ where: { planId } });
      if (uniqueFeatures.length) await tx.planFeature.createMany({ data: uniqueFeatures.map((key) => ({ planId, key })) });
    }
    const updated = await tx.plan.findUniqueOrThrow({ where: { id: planId }, include: includeFeatures });
    return serialize(updated);
  });
}

export async function setPlanStatus(planId: string, raw: unknown) {
  const input = parseInput(planStatusSchema, raw);
  const existing = await prisma.plan.findUnique({ where: { id: planId }, select: { id: true, status: true } });
  if (!existing) throw new HttpError("NOT_FOUND", "Plan not found");
  const next = planStatusFromUi[input.status];
  if (existing.status === next) throw new HttpError("CONFLICT", `Plan is already ${input.status}`);

  const updated = await prisma.plan.update({
    where: { id: planId },
    data: { status: next, archivedAt: next === "ARCHIVED" ? new Date() : null },
    include: includeFeatures,
  });
  return serialize(updated);
}
