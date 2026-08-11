// Platform (Super Admin) subscriptions service (Phase SA-4B). Connects a real
// School (+ its Tenant) to a real Plan. Plan pricing/features/limits stay the
// Plan's (the source of truth); only minimal commercial terms are snapshotted
// on the subscription (priceAmount + currency + billingInterval) so a historical
// price stays stable if the Plan later changes.
//
// No payment-provider IDs and NO proration/payment collection in SA-4B — plan
// changes simply re-snapshot terms and keep the current period.
//
// One-current-subscription invariant: a school has at most one CURRENT
// subscription (status in {TRIALING, ACTIVE, PAST_DUE}). Enforced here in a
// transaction AND by a partial unique index (see the SA-4B migration).
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import type { ListMeta } from "@/lib/server/api/response";
import {
  billingIntervalToUi,
  planStatusToUi,
  subscriptionStatusFromUi,
  subscriptionStatusToUi,
} from "@/lib/server/api/enums";
import { addDays, periodEnd } from "./billing-period";
import type { Prisma, SubscriptionStatus } from "@/lib/generated/prisma/client";

// Statuses that count as an active/"current" subscription (mirrors the partial
// unique index predicate). CANCELLED/ENDED are terminal history.
const CURRENT_STATUSES: SubscriptionStatus[] = ["TRIALING", "ACTIVE", "PAST_DUE"];

// --- Validation -------------------------------------------------------------

const nonNegInt = z.number().int().min(0);

export const subscriptionCreateSchema = z.object({
  schoolId: z.string().trim().min(1, "schoolId is required"),
  planId: z.string().trim().min(1, "planId is required"),
  // "active" starts a paid ACTIVE subscription immediately; "trial" starts a
  // TRIALING one using trialDays (defaults to the plan's trialDays).
  startMode: z.enum(["active", "trial"]).default("active"),
  trialDays: nonNegInt.optional(),
});

export const subscriptionUpdateSchema = z.object({
  // Toggle cancel-at-period-end (schedule cancellation / reactivate a pending one).
  cancelAtPeriodEnd: z.boolean(),
});

export const subscriptionStatusSchema = z.object({
  status: z.enum(["active", "past-due", "cancelled", "ended"]),
});

export const changePlanSchema = z.object({
  planId: z.string().trim().min(1, "planId is required"),
});

// --- Serializer -------------------------------------------------------------

type SubscriptionRow = Prisma.SubscriptionGetPayload<{
  include: {
    school: { select: { id: true; name: true; code: true; status: true } };
    tenant: { select: { id: true; name: true; slug: true } };
    plan: {
      select: {
        id: true;
        code: true;
        name: true;
        status: true;
        price: true;
        currency: true;
        billingInterval: true;
        maxStudents: true;
        maxStaff: true;
        maxBranches: true;
        storageGb: true;
        features: { select: { key: true } };
      };
    };
  };
}>;

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function serialize(s: SubscriptionRow) {
  return {
    id: s.id,
    status: subscriptionStatusToUi[s.status],
    isCurrent: CURRENT_STATUSES.includes(s.status),
    school: { id: s.school.id, name: s.school.name, code: s.school.code, status: s.school.status },
    tenant: { id: s.tenant.id, name: s.tenant.name, slug: s.tenant.slug },
    plan: {
      id: s.plan.id,
      code: s.plan.code,
      name: s.plan.name,
      status: planStatusToUi[s.plan.status],
      price: Number(s.plan.price),
      currency: s.plan.currency,
      billingInterval: billingIntervalToUi[s.plan.billingInterval],
      limits: {
        maxStudents: s.plan.maxStudents,
        maxStaff: s.plan.maxStaff,
        maxBranches: s.plan.maxBranches,
        storageGb: s.plan.storageGb,
      },
      features: s.plan.features.map((f) => f.key),
    },
    // Snapshotted commercial terms (may differ from the live plan price).
    price: Number(s.priceAmount),
    currency: s.currency,
    billingInterval: billingIntervalToUi[s.billingInterval],
    startDate: s.startDate.toISOString(),
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    trialStart: iso(s.trialStart),
    trialEnd: iso(s.trialEnd),
    cancelAtPeriodEnd: s.cancelAtPeriodEnd,
    cancelledAt: iso(s.cancelledAt),
    endedAt: iso(s.endedAt),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export type SubscriptionDto = ReturnType<typeof serialize>;

const includeRelations = {
  school: { select: { id: true, name: true, code: true, status: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  plan: {
    select: {
      id: true,
      code: true,
      name: true,
      status: true,
      price: true,
      currency: true,
      billingInterval: true,
      maxStudents: true,
      maxStaff: true,
      maxBranches: true,
      storageGb: true,
      features: { select: { key: true } },
    },
  },
} as const;

// --- Reads ------------------------------------------------------------------

export type SubscriptionListParams = {
  page: number;
  pageSize: number;
  search?: string;
  status?: string;
  planId?: string;
  sort?: "createdAt" | "currentPeriodEnd" | "status";
  order?: "asc" | "desc";
};

export async function listSubscriptions(params: SubscriptionListParams) {
  const where: Prisma.SubscriptionWhereInput = {};
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { school: { name: { contains: q, mode: "insensitive" } } },
      { school: { code: { contains: q, mode: "insensitive" } } },
      { tenant: { name: { contains: q, mode: "insensitive" } } },
      { tenant: { slug: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (params.status && subscriptionStatusFromUi[params.status]) where.status = subscriptionStatusFromUi[params.status];
  if (params.planId) where.planId = params.planId;

  const order = params.order ?? "desc";
  let orderBy: Prisma.SubscriptionOrderByWithRelationInput;
  switch (params.sort) {
    case "currentPeriodEnd":
      orderBy = { currentPeriodEnd: order };
      break;
    case "status":
      orderBy = { status: order };
      break;
    default:
      orderBy = { createdAt: order };
  }

  const [total, rows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({ where, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: includeRelations }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map(serialize), meta };
}

export async function getSubscription(id: string) {
  const sub = await prisma.subscription.findUnique({ where: { id }, include: includeRelations });
  if (!sub) throw new HttpError("NOT_FOUND", "Subscription not found");
  return serialize(sub);
}

/** Count subscriptions in a UI status (real dashboard metric). */
export async function countByStatus(uiStatus: string): Promise<number> {
  const status = subscriptionStatusFromUi[uiStatus];
  if (!status) return 0;
  return prisma.subscription.count({ where: { status } });
}

// --- Writes -----------------------------------------------------------------

// Eligible schools for a new subscription: real, not archived/inactive.
const ELIGIBLE_SCHOOL_STATUSES = ["ACTIVE", "SETUP_PENDING"];

function isUniqueViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "P2002";
}

export async function createSubscription(raw: unknown) {
  const input = parseInput(subscriptionCreateSchema, raw);

  // Resolve tenant from the school — never trust a client-supplied tenantId.
  const school = await prisma.school.findUnique({ where: { id: input.schoolId }, select: { id: true, tenantId: true, status: true } });
  if (!school) throw new HttpError("INVALID_SCHOOL", "School not found");
  if (!ELIGIBLE_SCHOOL_STATUSES.includes(school.status)) {
    throw new HttpError("INVALID_SCHOOL", "This school is not eligible for a subscription");
  }

  const plan = await prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true, status: true, price: true, currency: true, billingInterval: true, trialDays: true } });
  if (!plan) throw new HttpError("INVALID_PLAN", "Plan not found");
  if (plan.status !== "ACTIVE") throw new HttpError("INVALID_PLAN", "Only active plans can be assigned");

  // One-current invariant (service-level; the partial unique index backs this up).
  const existingCurrent = await prisma.subscription.findFirst({ where: { schoolId: school.id, status: { in: CURRENT_STATUSES } }, select: { id: true } });
  if (existingCurrent) throw new HttpError("SUBSCRIPTION_EXISTS", "This school already has a current subscription");

  const now = new Date();
  const trialDays = input.startMode === "trial" ? (input.trialDays ?? plan.trialDays) : 0;
  const useTrial = input.startMode === "trial" && trialDays > 0;

  let data: Prisma.SubscriptionCreateInput;
  const base = {
    tenant: { connect: { id: school.tenantId } },
    school: { connect: { id: school.id } },
    plan: { connect: { id: plan.id } },
    startDate: now,
    priceAmount: plan.price,
    currency: plan.currency,
    billingInterval: plan.billingInterval,
  };
  if (useTrial) {
    const trialEnd = addDays(now, trialDays);
    data = { ...base, status: "TRIALING", trialStart: now, trialEnd, currentPeriodStart: now, currentPeriodEnd: trialEnd };
  } else {
    data = { ...base, status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd(now, plan.billingInterval) };
  }

  try {
    const created = await prisma.subscription.create({ data, include: includeRelations });
    return serialize(created);
  } catch (e) {
    if (isUniqueViolation(e)) throw new HttpError("SUBSCRIPTION_EXISTS", "This school already has a current subscription");
    throw e;
  }
}

export async function updateSubscription(id: string, raw: unknown) {
  const input = parseInput(subscriptionUpdateSchema, raw);
  const sub = await prisma.subscription.findUnique({ where: { id }, select: { id: true, status: true } });
  if (!sub) throw new HttpError("NOT_FOUND", "Subscription not found");
  if (!CURRENT_STATUSES.includes(sub.status)) {
    throw new HttpError("CONFLICT", "Only a current subscription can be scheduled for cancellation");
  }
  const updated = await prisma.subscription.update({ where: { id }, data: { cancelAtPeriodEnd: input.cancelAtPeriodEnd }, include: includeRelations });
  return serialize(updated);
}

export async function setSubscriptionStatus(id: string, raw: unknown) {
  const input = parseInput(subscriptionStatusSchema, raw);
  const sub = await prisma.subscription.findUnique({
    where: { id },
    select: { id: true, status: true, currentPeriodStart: true, billingInterval: true },
  });
  if (!sub) throw new HttpError("NOT_FOUND", "Subscription not found");

  const now = new Date();
  const data: Prisma.SubscriptionUpdateInput = {};

  switch (input.status) {
    case "active":
      // Activate a trial or recover a past-due subscription: start a fresh period.
      if (sub.status !== "TRIALING" && sub.status !== "PAST_DUE") {
        throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot activate a ${subscriptionStatusToUi[sub.status]} subscription`);
      }
      data.status = "ACTIVE";
      data.currentPeriodStart = now;
      data.currentPeriodEnd = periodEnd(now, sub.billingInterval);
      if (sub.status === "TRIALING") data.trialEnd = now;
      break;
    case "past-due":
      if (sub.status !== "ACTIVE") {
        throw new HttpError("INVALID_STATUS_TRANSITION", `Cannot mark a ${subscriptionStatusToUi[sub.status]} subscription past due`);
      }
      data.status = "PAST_DUE";
      break;
    case "cancelled":
      // Immediate cancellation — terminal.
      if (!CURRENT_STATUSES.includes(sub.status)) {
        throw new HttpError("INVALID_STATUS_TRANSITION", "Subscription is already terminal");
      }
      data.status = "CANCELLED";
      data.cancelledAt = now;
      data.endedAt = now;
      data.cancelAtPeriodEnd = false;
      break;
    case "ended":
      if (!CURRENT_STATUSES.includes(sub.status)) {
        throw new HttpError("INVALID_STATUS_TRANSITION", "Subscription is already terminal");
      }
      data.status = "ENDED";
      data.endedAt = now;
      break;
  }

  const updated = await prisma.subscription.update({ where: { id }, data, include: includeRelations });
  return serialize(updated);
}

export async function changePlan(id: string, raw: unknown) {
  const input = parseInput(changePlanSchema, raw);
  const sub = await prisma.subscription.findUnique({ where: { id }, select: { id: true, status: true, planId: true } });
  if (!sub) throw new HttpError("NOT_FOUND", "Subscription not found");
  if (!CURRENT_STATUSES.includes(sub.status)) {
    throw new HttpError("CONFLICT", "Only a current subscription can change plan");
  }
  if (sub.planId === input.planId) throw new HttpError("CONFLICT", "Subscription is already on this plan");

  const plan = await prisma.plan.findUnique({ where: { id: input.planId }, select: { id: true, status: true, price: true, currency: true, billingInterval: true } });
  if (!plan) throw new HttpError("INVALID_PLAN", "Plan not found");
  if (plan.status !== "ACTIVE") throw new HttpError("INVALID_PLAN", "Only active plans can be assigned");

  // No proration / payment collection in SA-4B: re-snapshot commercial terms and
  // keep the current period. The next renewal uses the new plan's price.
  const updated = await prisma.subscription.update({
    where: { id },
    data: {
      plan: { connect: { id: plan.id } },
      priceAmount: plan.price,
      currency: plan.currency,
      billingInterval: plan.billingInterval,
    },
    include: includeRelations,
  });
  return serialize(updated);
}
