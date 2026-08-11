"use client";

// Real subscription detail + actions (Super Admin SA-4B). Reads
// GET /api/super-admin/subscriptions/:id and drives change-plan / cancel /
// activate via the real endpoints. No mock store, no fake invoice/payment history.
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  useSubscription,
  changeSubscriptionPlanRequest,
  setSubscriptionCancelAtPeriodEnd,
  setSubscriptionStatusRequest,
} from "@/lib/hooks/api/use-subscriptions";
import { usePlanList, formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { subscriptionStatusLabel, subscriptionStatusTone } from "@/lib/plans/subscription-status";
import { featureLabel } from "@/lib/plans/features";
import { formatDate } from "@/lib/utils";

const CURRENT = new Set(["trialing", "active", "past-due"]);

export default function SubscriptionDetailPage({ params }: { params: Promise<{ subscriptionId: string }> }) {
  const { subscriptionId } = use(params);
  const { can } = usePermissions();
  const manage = can("platform.subscriptions.manage");
  const { data: sub, loading, error, reload } = useSubscription(subscriptionId);
  const { data: plans } = usePlanList({ status: "active", pageSize: 100, sort: "sortOrder" });

  const [targetPlan, setTargetPlan] = useState<string>("");
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const newPlan = useMemo(() => plans.find((p) => p.id === targetPlan), [plans, targetPlan]);

  if (loading && !sub) {
    return <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading subscription…</div>;
  }
  if (error || !sub) {
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        {error ?? "Subscription not found."} <Link href="/super-admin/subscriptions" className="text-primary">Back</Link>
      </div>
    );
  }

  const isCurrent = CURRENT.has(sub.status);

  async function run(fn: () => Promise<{ success: boolean; error?: { message: string } }>, okText: string) {
    setMsg(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) {
      setMsg({ tone: "error", text: res.error?.message ?? "Action failed" });
      return;
    }
    setMsg({ tone: "success", text: okText });
    setTargetPlan("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/subscriptions">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">{sub.school.name}</h1>
            <Badge tone={subscriptionStatusTone(sub.status)}>{subscriptionStatusLabel(sub.status)}</Badge>
            {sub.cancelAtPeriodEnd && <Badge tone="warning">Cancels at period end</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {sub.plan.name} · {sub.tenant.name} · {formatPlanPrice(sub.price, sub.currency)} {sub.billingInterval}
          </p>
        </div>
      </div>

      {msg && (
        <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>
          {msg.text}
        </p>
      )}

      {/* Lifecycle actions */}
      {manage && isCurrent && (
        <div className="flex flex-wrap gap-xs">
          {(sub.status === "trialing" || sub.status === "past-due") && (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setSubscriptionStatusRequest(sub.id, "active"), "Subscription activated.")}>
              <CheckCircle2 className="size-3.5" /> Activate
            </Button>
          )}
          {!sub.cancelAtPeriodEnd ? (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setSubscriptionCancelAtPeriodEnd(sub.id, true), "Will cancel at period end.")}>
              Cancel at period end
            </Button>
          ) : (
            <Button size="sm" variant="outline" disabled={busy} onClick={() => run(() => setSubscriptionCancelAtPeriodEnd(sub.id, false), "Cancellation reverted — subscription continues.")}>
              Resume (keep active)
            </Button>
          )}
          <Button size="sm" variant="ghost" disabled={busy} onClick={() => run(() => setSubscriptionStatusRequest(sub.id, "cancelled"), "Subscription cancelled.")}>
            Cancel now
          </Button>
        </div>
      )}

      {/* Change plan */}
      {manage && isCurrent && (
        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Change plan</h2>
          <p className="mb-sm text-xs text-muted-foreground">No proration or payment is collected in this phase — the new plan&apos;s price applies from the next renewal.</p>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground">{sub.plan.name}</span>
            <ArrowRight className="size-4 text-muted-foreground" />
            <Select value={targetPlan} onValueChange={setTargetPlan}>
              <SelectTrigger aria-label="New plan" className="w-52">
                <SelectValue placeholder="Select new plan" />
              </SelectTrigger>
              <SelectContent>
                {plans
                  .filter((p) => p.id !== sub.plan.id)
                  .map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {formatPlanPrice(p.price, p.currency)}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            {newPlan && (
              <Button size="sm" disabled={busy} onClick={() => run(() => changeSubscriptionPlanRequest(sub.id, newPlan.id), `Plan changed to ${newPlan.name}.`)}>
                Confirm change
              </Button>
            )}
          </div>
        </section>
      )}

      {/* Facts */}
      <div className="rounded-lg border border-border bg-surface p-md text-sm">
        <dl className="grid grid-cols-2 gap-y-2 sm:grid-cols-3">
          <Fact label="School" value={`${sub.school.name} (${sub.school.code})`} />
          <Fact label="Tenant" value={sub.tenant.name} />
          <Fact label="Plan" value={sub.plan.name} />
          <Fact label="Price" value={`${formatPlanPrice(sub.price, sub.currency)} / ${sub.billingInterval}`} />
          <Fact label="Started" value={formatDate(sub.startDate)} />
          <Fact label="Period" value={`${formatDate(sub.currentPeriodStart)} → ${formatDate(sub.currentPeriodEnd)}`} />
          {sub.trialStart && sub.trialEnd && <Fact label="Trial" value={`${formatDate(sub.trialStart)} → ${formatDate(sub.trialEnd)}`} />}
          <Fact label="Cancel at period end" value={sub.cancelAtPeriodEnd ? "Yes" : "No"} />
          {sub.cancelledAt && <Fact label="Cancelled" value={formatDate(sub.cancelledAt)} />}
          {sub.endedAt && <Fact label="Ended" value={formatDate(sub.endedAt)} />}
          <Fact label="Created" value={formatDate(sub.createdAt)} />
          <Fact label="Updated" value={formatDate(sub.updatedAt)} />
        </dl>
      </div>

      {/* Plan entitlements (live from the plan — source of truth) */}
      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Plan entitlements</h2>
        <div className="flex flex-wrap gap-xs">
          {sub.plan.features.length === 0 ? (
            <span className="text-sm text-muted-foreground">No features.</span>
          ) : (
            sub.plan.features.map((f) => (
              <Badge key={f} tone="info">{featureLabel(f)}</Badge>
            ))
          )}
        </div>
      </section>

      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">
        Invoices and payments are not part of this phase — no billing history is shown yet.
      </p>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-foreground">{value}</dd>
    </div>
  );
}
