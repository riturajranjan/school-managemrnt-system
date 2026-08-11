"use client";

// Real "Assign subscription" form (Super Admin SA-4B). Submits to
// POST /api/super-admin/subscriptions. School + plan selectors load real data;
// the server resolves the tenant from the school (never trusted from the client).
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useSchoolList } from "@/lib/hooks/api/use-platform-schools";
import { usePlanList, formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { createSubscriptionRequest } from "@/lib/hooks/api/use-subscriptions";

export default function NewSubscriptionPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [schoolId, setSchoolId] = useState("");
  const [planId, setPlanId] = useState("");
  const [startMode, setStartMode] = useState<"active" | "trial">("active");
  const [trialDays, setTrialDays] = useState<string>("");

  // Only ACTIVE schools/plans are assignable (§19/§20).
  const { data: schools, loading: schoolsLoading } = useSchoolList({ status: "active", pageSize: 100 });
  const { data: plans, loading: plansLoading } = usePlanList({ status: "active", pageSize: 100, sort: "sortOrder" });

  const selectedPlan = useMemo(() => plans.find((p) => p.id === planId), [plans, planId]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);
    if (!schoolId) return setSubmitError("Select a school.");
    if (!planId) return setSubmitError("Select a plan.");
    setSubmitting(true);
    const body: Record<string, unknown> = { schoolId, planId, startMode };
    if (startMode === "trial" && trialDays.trim() !== "") body.trialDays = Number(trialDays);
    const res = await createSubscriptionRequest(body);
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(res.error.message);
      return;
    }
    router.push(`/super-admin/subscriptions/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/subscriptions">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <CreditCard className="size-5 text-primary" /> Assign subscription
        </h1>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {submitError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{submitError}</p>}

        <div>
          <Label htmlFor="school">School *</Label>
          <select
            id="school"
            value={schoolId}
            onChange={(e) => setSchoolId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="">{schoolsLoading ? "Loading schools…" : "Select a school"}</option>
            {schools.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.code}) · {s.tenantName}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-muted-foreground">Only active schools are shown. The tenant is resolved automatically.</p>
        </div>

        <div>
          <Label htmlFor="plan">Plan *</Label>
          <select
            id="plan"
            value={planId}
            onChange={(e) => setPlanId(e.target.value)}
            className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="">{plansLoading ? "Loading plans…" : "Select a plan"}</option>
            {plans.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {formatPlanPrice(p.price, p.currency)}
                {p.billingInterval === "yearly" ? "/yr" : "/mo"}
              </option>
            ))}
          </select>
          {selectedPlan && (
            <p className="mt-1 text-xs text-muted-foreground">
              {formatPlanPrice(selectedPlan.price, selectedPlan.currency)} {selectedPlan.billingInterval} · {selectedPlan.trialDays}-day trial available
            </p>
          )}
        </div>

        <div>
          <Label htmlFor="startMode">Start mode</Label>
          <select
            id="startMode"
            value={startMode}
            onChange={(e) => setStartMode(e.target.value as "active" | "trial")}
            className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
          >
            <option value="active">Active (paid) now</option>
            <option value="trial">Trial</option>
          </select>
        </div>

        {startMode === "trial" && (
          <div>
            <Label htmlFor="trialDays">Trial days (blank = plan default{selectedPlan ? `: ${selectedPlan.trialDays}` : ""})</Label>
            <Input id="trialDays" type="number" min={0} value={trialDays} onChange={(e) => setTrialDays(e.target.value)} placeholder={selectedPlan ? String(selectedPlan.trialDays) : "14"} />
            <p className="mt-1 text-xs text-muted-foreground">No payment is collected in this phase. A 0-day trial starts an active subscription.</p>
          </div>
        )}

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => router.push("/super-admin/subscriptions")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Assigning…" : "Assign subscription"}
          </Button>
        </div>
      </form>
    </div>
  );
}
