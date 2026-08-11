// Platform (Super Admin) trials service (Phase SA-4C). Trials are NOT a separate
// model — they are Subscriptions with a trial window (trialStart/trialEnd set),
// so this service reads/writes the existing `subscriptions` table. Source of
// truth: Subscription.status === TRIALING plus trialStart/trialEnd.
//
// Expiration policy (deterministic, no scheduler in this project): a TRIALING
// subscription whose trialEnd has passed is *surfaced* as `expired` on read — it
// is NOT auto-transitioned to ENDED. Moving to ENDED requires the explicit End
// action (or Convert → ACTIVE). All expiration/state logic is centralized in
// `deriveState()` so no UI component recomputes business state.
//
// Conversion activates the subscription record only. Billing/payment collection
// is a later phase (Billing/Payments) — nothing is charged here.
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { parseInput } from "@/lib/server/validation";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import { billingIntervalToUi, subscriptionStatusToUi } from "@/lib/server/api/enums";
import { addDays, periodEnd } from "./billing-period";
import type { Prisma } from "@/lib/generated/prisma/client";

export type TrialActor = { id: string; name: string | null };

// A trial is "expiring soon" within this many days of trialEnd.
export const EXPIRING_THRESHOLD_DAYS = 3;
const MS_PER_DAY = 86_400_000;
// Guard-rail on a single extension.
const MAX_EXTEND_DAYS = 90;

// --- Validation -------------------------------------------------------------

export const extendTrialSchema = z.object({
  days: z.number().int().min(1, "Extension must be at least 1 day").max(MAX_EXTEND_DAYS, `Extension cannot exceed ${MAX_EXTEND_DAYS} days`),
});

// --- State derivation (centralized) -----------------------------------------

export type TrialState = "active" | "expiring" | "expired" | "converted" | "ended";

function deriveState(status: string, trialEnd: Date | null, now: Date): TrialState {
  if (status === "ACTIVE") return "converted"; // was a trial (trialStart set), now active
  if (status === "ENDED") return "ended";
  // status === TRIALING (only trial-origin rows reach here)
  if (!trialEnd) return "active";
  if (trialEnd.getTime() <= now.getTime()) return "expired";
  if (trialEnd.getTime() - now.getTime() <= EXPIRING_THRESHOLD_DAYS * MS_PER_DAY) return "expiring";
  return "active";
}

function daysRemaining(trialEnd: Date | null, now: Date): number {
  if (!trialEnd) return 0;
  return Math.ceil((trialEnd.getTime() - now.getTime()) / MS_PER_DAY);
}

// --- Serializer -------------------------------------------------------------

type TrialRow = Prisma.SubscriptionGetPayload<{
  include: {
    school: { select: { id: true; name: true; code: true; status: true } };
    tenant: { select: { id: true; name: true; slug: true } };
    plan: { select: { id: true; code: true; name: true; price: true; currency: true; billingInterval: true } };
  };
}>;

function iso(d: Date | null): string | null {
  return d ? d.toISOString() : null;
}

function serialize(s: TrialRow, now: Date) {
  return {
    subscriptionId: s.id,
    state: deriveState(s.status, s.trialEnd, now),
    status: subscriptionStatusToUi[s.status],
    school: { id: s.school.id, name: s.school.name, code: s.school.code, status: s.school.status },
    tenant: { id: s.tenant.id, name: s.tenant.name, slug: s.tenant.slug },
    plan: {
      id: s.plan.id,
      code: s.plan.code,
      name: s.plan.name,
      price: Number(s.plan.price),
      currency: s.plan.currency,
      billingInterval: billingIntervalToUi[s.plan.billingInterval],
    },
    trialStart: iso(s.trialStart),
    trialEnd: iso(s.trialEnd),
    daysRemaining: daysRemaining(s.trialEnd, now), // server-computed; may be ≤0 when expired
    currentPeriodStart: s.currentPeriodStart.toISOString(),
    currentPeriodEnd: s.currentPeriodEnd.toISOString(),
    endedAt: iso(s.endedAt),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

export type TrialDto = ReturnType<typeof serialize>;

const includeRelations = {
  school: { select: { id: true, name: true, code: true, status: true } },
  tenant: { select: { id: true, name: true, slug: true } },
  plan: { select: { id: true, code: true, name: true, price: true, currency: true, billingInterval: true } },
} as const;

function auditScope(actor: TrialActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor };
}

// --- Reads ------------------------------------------------------------------

export type TrialListParams = {
  page: number;
  pageSize: number;
  search?: string;
  planId?: string;
  state?: string;
  sort?: "trialEnd" | "createdAt";
  order?: "asc" | "desc";
};

/** Where-clause for a derived state (uses a caller-provided `now`). */
function stateWhere(state: string | undefined, now: Date): Prisma.SubscriptionWhereInput {
  switch (state) {
    case "active":
      return { status: "TRIALING", trialEnd: { gt: now } };
    case "expiring":
      return { status: "TRIALING", trialEnd: { gt: now, lte: addDays(now, EXPIRING_THRESHOLD_DAYS) } };
    case "expired":
      return { status: "TRIALING", trialEnd: { lte: now } };
    case "converted":
      return { status: "ACTIVE" };
    case "ended":
      return { status: "ENDED" };
    default:
      return {};
  }
}

export async function listTrials(params: TrialListParams) {
  const now = new Date();
  // Base set: only trial-origin subscriptions (a trial window was set).
  const where: Prisma.SubscriptionWhereInput = { trialStart: { not: null }, ...stateWhere(params.state, now) };
  if (params.search) {
    const q = params.search.trim();
    where.OR = [
      { school: { name: { contains: q, mode: "insensitive" } } },
      { school: { code: { contains: q, mode: "insensitive" } } },
      { tenant: { name: { contains: q, mode: "insensitive" } } },
      { tenant: { slug: { contains: q, mode: "insensitive" } } },
    ];
  }
  if (params.planId) where.planId = params.planId;

  const order = params.order ?? "asc";
  const orderBy: Prisma.SubscriptionOrderByWithRelationInput = params.sort === "createdAt" ? { createdAt: order } : { trialEnd: order };

  const [total, rows] = await Promise.all([
    prisma.subscription.count({ where }),
    prisma.subscription.findMany({ where, orderBy, skip: (params.page - 1) * params.pageSize, take: params.pageSize, include: includeRelations }),
  ]);
  const meta: ListMeta = { page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
  return { data: rows.map((r) => serialize(r, now)), meta };
}

/** Load a trial-origin subscription or throw NOT_FOUND (also for non-trial rows). */
async function loadTrialRow(id: string): Promise<TrialRow> {
  const row = await prisma.subscription.findFirst({ where: { id, trialStart: { not: null } }, include: includeRelations });
  if (!row) throw new HttpError("NOT_FOUND", "Trial not found");
  return row;
}

export async function getTrial(id: string) {
  return serialize(await loadTrialRow(id), new Date());
}

// --- Writes -----------------------------------------------------------------

export async function extendTrial(actor: TrialActor, id: string, raw: unknown) {
  const input = parseInput(extendTrialSchema, raw);
  const row = await loadTrialRow(id);
  if (row.status !== "TRIALING") {
    throw new HttpError("INVALID_STATUS_TRANSITION", "Only a trialing subscription can be extended");
  }
  const now = new Date();
  // Extend from the later of the current trial end or now (extends an already
  // expired trial into the future rather than leaving it in the past).
  const base = row.trialEnd && row.trialEnd.getTime() > now.getTime() ? row.trialEnd : now;
  const newTrialEnd = addDays(base, input.days);

  const updated = await prisma.subscription.update({
    where: { id },
    data: { trialEnd: newTrialEnd, currentPeriodEnd: newTrialEnd },
    include: includeRelations,
  });
  await recordAudit(prisma, auditScope(actor, row.tenantId, row.schoolId), "TRIAL_EXTENDED", "Subscription", id, {
    days: input.days,
    trialEnd: newTrialEnd.toISOString(),
  });
  return serialize(updated, now);
}

export async function convertTrial(actor: TrialActor, id: string) {
  const row = await loadTrialRow(id);
  if (row.status !== "TRIALING") {
    throw new HttpError("INVALID_STATUS_TRANSITION", "Only a trialing subscription can be converted");
  }
  const now = new Date();
  // Activate the subscription with a fresh billing period from the plan interval.
  // trialStart/trialEnd are preserved as history. No payment is collected.
  const updated = await prisma.subscription.update({
    where: { id },
    data: { status: "ACTIVE", currentPeriodStart: now, currentPeriodEnd: periodEnd(now, row.billingInterval) },
    include: includeRelations,
  });
  await recordAudit(prisma, auditScope(actor, row.tenantId, row.schoolId), "TRIAL_CONVERTED", "Subscription", id, {
    plan: row.plan.code,
    billingInterval: billingIntervalToUi[row.billingInterval],
  });
  return serialize(updated, now);
}

export async function endTrial(actor: TrialActor, id: string) {
  const row = await loadTrialRow(id);
  if (row.status !== "TRIALING") {
    throw new HttpError("INVALID_STATUS_TRANSITION", "Only a trialing subscription can be ended");
  }
  const now = new Date();
  const updated = await prisma.subscription.update({
    where: { id },
    data: { status: "ENDED", endedAt: now },
    include: includeRelations,
  });
  await recordAudit(prisma, auditScope(actor, row.tenantId, row.schoolId), "TRIAL_ENDED", "Subscription", id);
  return serialize(updated, now);
}
