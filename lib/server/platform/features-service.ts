// Feature entitlement service (Super Admin Phase SA-4L).
//
// Feature ENTITLEMENT answers "does this SCHOOL/PLAN have this module?" and is
// SEPARATE from RBAC ("can this USER perform this action?"). Effective module
// access requires BOTH: an enabled feature AND an allowed permission.
//
// Resolution: the school's current Subscription → Plan → PlanFeature keys are
// the plan DEFAULT (a key is enabled when a PlanFeature row exists). A
// SchoolFeatureOverride then flips one key on/off for that school. Precedence is
// centralised here: effective = override ?? plan-default. No school subscription
// → every plan default is off.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import type { OrgScope } from "@/lib/server/api/scope";
import { FEATURE_KEYS, featureLabel } from "@/lib/plans/features";
import { resolveSchoolTarget } from "./school-target";

// The subscription statuses that count as a school's CURRENT plan (matches
// health-service / subscriptions-service; one-current-per-school invariant).
const CURRENT_SUB_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE"] as const;

export type FeatureActor = { id: string; name: string | null };

export type EffectiveFeature = {
  key: string;
  label: string;
  planDefault: boolean; // included by the current plan?
  override: boolean | null; // explicit school override, or null if none
  effective: boolean; // override ?? planDefault
  reason: string | null;
};

export type SchoolFeatures = {
  school: { id: string; name: string };
  tenant: { id: string };
  plan: { id: string; name: string } | null; // current plan, or null if no subscription
  hasSubscription: boolean;
  features: EffectiveFeature[];
};

function auditScope(actor: FeatureActor, tenantId: string, schoolId: string): OrgScope {
  return { tenantId, schoolId, branchId: null, academicSessionId: null, actor: { id: actor.id, name: actor.name } };
}

function assertKnownFeature(key: string): void {
  if (!FEATURE_KEYS.includes(key)) throw new HttpError("VALIDATION_ERROR", `Unknown feature "${key}"`);
}

/** The current plan (+ its feature keys) for a school, or null when unsubscribed. */
async function currentPlanFor(schoolId: string): Promise<{ id: string; name: string; keys: Set<string> } | null> {
  const sub = await prisma.subscription.findFirst({
    where: { schoolId, status: { in: [...CURRENT_SUB_STATUSES] } },
    select: { plan: { select: { id: true, name: true, features: { select: { key: true } } } } },
  });
  if (!sub) return null;
  return { id: sub.plan.id, name: sub.plan.name, keys: new Set(sub.plan.features.map((f) => f.key)) };
}

/**
 * The single server-side resolver for a school's effective feature set. Every
 * catalog key is returned with its plan default, override, and effective state.
 */
export async function getEffectiveFeaturesForSchool(schoolId: string): Promise<SchoolFeatures> {
  const target = await resolveSchoolTarget(schoolId);
  const [plan, overrideRows] = await Promise.all([
    currentPlanFor(schoolId),
    prisma.schoolFeatureOverride.findMany({ where: { schoolId }, select: { featureKey: true, enabled: true, reason: true } }),
  ]);
  const overrides = new Map(overrideRows.map((o) => [o.featureKey, o]));

  const features: EffectiveFeature[] = FEATURE_KEYS.map((key) => {
    const planDefault = plan?.keys.has(key) ?? false;
    const ov = overrides.get(key);
    const override = ov ? ov.enabled : null;
    return {
      key,
      label: featureLabel(key),
      planDefault,
      override,
      effective: override ?? planDefault,
      reason: ov?.reason ?? null,
    };
  });

  return {
    school: { id: target.schoolId, name: target.name },
    tenant: { id: target.tenantId },
    plan: plan ? { id: plan.id, name: plan.name } : null,
    hasSubscription: plan != null,
    features,
  };
}

/** Set (or replace) a school's override for one feature key. */
export async function setFeatureOverride(args: {
  actor: FeatureActor;
  schoolId: string;
  featureKey: string;
  enabled: boolean;
  reason?: string | null;
}): Promise<SchoolFeatures> {
  const { actor, schoolId, featureKey, enabled, reason } = args;
  assertKnownFeature(featureKey);
  const target = await resolveSchoolTarget(schoolId);

  await prisma.$transaction(async (tx) => {
    await tx.schoolFeatureOverride.upsert({
      where: { schoolId_featureKey: { schoolId, featureKey } },
      update: { enabled, reason: reason ?? null, createdBy: actor.id },
      create: { schoolId, tenantId: target.tenantId, featureKey, enabled, reason: reason ?? null, createdBy: actor.id },
    });
    await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "FEATURE_OVERRIDE_SET", "SchoolFeatureOverride", `${schoolId}:${featureKey}`, { featureKey, enabled });
  });

  return getEffectiveFeaturesForSchool(schoolId);
}

/** Remove a school's override for one feature key (revert to the plan default). */
export async function clearFeatureOverride(args: {
  actor: FeatureActor;
  schoolId: string;
  featureKey: string;
}): Promise<SchoolFeatures> {
  const { actor, schoolId, featureKey } = args;
  assertKnownFeature(featureKey);
  const target = await resolveSchoolTarget(schoolId);

  await prisma.$transaction(async (tx) => {
    const deleted = await tx.schoolFeatureOverride.deleteMany({ where: { schoolId, featureKey } });
    if (deleted.count > 0) {
      await recordAudit(tx, auditScope(actor, target.tenantId, schoolId), "FEATURE_OVERRIDE_CLEARED", "SchoolFeatureOverride", `${schoolId}:${featureKey}`, { featureKey });
    }
  });

  return getEffectiveFeaturesForSchool(schoolId);
}

// ---------------------------------------------------------------------------
// Enforcement foundation (SA-4L). Future business-module phases should gate a
// module behind BOTH the feature entitlement AND the RBAC permission, e.g.:
//     await requirePermission("students.view");   // RBAC — can the USER?
//     await requireFeature(scope.schoolId, "students"); // entitlement — does the SCHOOL?
// This resolves the same effective state as the UI above (no divergent logic).
// Deliberately NOT wired into every existing business API yet — this is the
// clean, reusable foundation for those later phases.
// ---------------------------------------------------------------------------

/** Effective entitlement for a single (school, feature) — the enforcement primitive. */
export async function hasFeature(schoolId: string, featureKey: string): Promise<boolean> {
  assertKnownFeature(featureKey);
  const [plan, override] = await Promise.all([
    currentPlanFor(schoolId),
    prisma.schoolFeatureOverride.findUnique({ where: { schoolId_featureKey: { schoolId, featureKey } }, select: { enabled: true } }),
  ]);
  const planDefault = plan?.keys.has(featureKey) ?? false;
  return override ? override.enabled : planDefault;
}

/** Throw FORBIDDEN unless the school is entitled to the feature. */
export async function requireFeature(schoolId: string, featureKey: string): Promise<void> {
  if (!(await hasFeature(schoolId, featureKey))) {
    throw new HttpError("FORBIDDEN", `This school's plan does not include "${featureKey}"`);
  }
}
