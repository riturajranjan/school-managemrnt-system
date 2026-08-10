"use client";

// Real plan detail + edit (Super Admin SA-4A). Reads GET /api/super-admin/plans/:id,
// saves via PATCH, and archives/activates via POST /:id/status. No mock store.
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Archive, ArrowLeft, CheckCircle2, Package } from "lucide-react";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { usePlan, updatePlanRequest, setPlanStatusRequest, formatPlanPrice } from "@/lib/hooks/api/use-plans";
import { FEATURE_KEYS, FEATURE_LABELS, featureLabel } from "@/lib/plans/features";
import type { PlanDto } from "@/lib/api/contracts";
import type { StatusTone } from "@/lib/types/common";

const statusTone: Record<string, StatusTone> = { draft: "neutral", active: "success", archived: "neutral" };

const optionalLimit = z
  .union([z.literal(""), z.coerce.number().int().min(0)])
  .transform((v) => (v === "" ? null : v));

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().optional().or(z.literal("")),
  price: z.coerce.number().min(0, "Price cannot be negative"),
  currency: z.string().trim().length(3, "3-letter ISO code"),
  billingInterval: z.enum(["monthly", "yearly"]),
  trialDays: z.coerce.number().int().min(0),
  sortOrder: z.coerce.number().int(),
  maxStudents: optionalLimit,
  maxStaff: optionalLimit,
  maxBranches: optionalLimit,
  storageGb: optionalLimit,
  supportLevel: z.string().trim().optional().or(z.literal("")),
  whiteLabel: z.boolean(),
  isPublic: z.boolean(),
});
type Values = z.input<typeof schema>;

function limitToField(v: number | null): number | "" {
  return v === null ? "" : v;
}

export default function PlanDetailPage({ params }: { params: Promise<{ planId: string }> }) {
  const { planId } = use(params);
  const { can } = usePermissions();
  const manage = can("platform.plans.manage");
  const { data: plan, loading, error, reload } = usePlan(planId);

  if (loading && !plan) {
    return <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading plan…</div>;
  }
  if (error || !plan) {
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        {error ?? "Plan not found."} <Link href="/super-admin/plans" className="text-primary">Back</Link>
      </div>
    );
  }

  return <PlanDetail plan={plan} manage={manage} reload={reload} />;
}

function PlanDetail({ plan, manage, reload }: { plan: PlanDto; manage: boolean; reload: () => void }) {
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const defaults: Values = useMemo(
    () => ({
      name: plan.name,
      description: plan.description ?? "",
      price: plan.price,
      currency: plan.currency,
      billingInterval: plan.billingInterval === "yearly" ? "yearly" : "monthly",
      trialDays: plan.trialDays,
      sortOrder: plan.sortOrder,
      maxStudents: limitToField(plan.limits.maxStudents),
      maxStaff: limitToField(plan.limits.maxStaff),
      maxBranches: limitToField(plan.limits.maxBranches),
      storageGb: limitToField(plan.limits.storageGb),
      supportLevel: plan.supportLevel ?? "",
      whiteLabel: plan.whiteLabel,
      isPublic: plan.isPublic,
    }),
    [plan],
  );

  const [features, setFeatures] = useState<string[]>(plan.features);
  const { register, handleSubmit, formState, reset } = useForm<Values>({ resolver: zodResolver(schema), values: defaults });
  const errors = formState.errors;

  function toggleFeature(key: string) {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function onSave(values: Values) {
    setMsg(null);
    setBusy(true);
    const parsed = schema.parse(values);
    const res = await updatePlanRequest(plan.id, {
      name: parsed.name.trim(),
      description: parsed.description?.trim() || undefined,
      price: parsed.price,
      currency: parsed.currency.trim().toUpperCase(),
      billingInterval: parsed.billingInterval,
      trialDays: parsed.trialDays,
      sortOrder: parsed.sortOrder,
      supportLevel: parsed.supportLevel?.trim() || undefined,
      whiteLabel: parsed.whiteLabel,
      isPublic: parsed.isPublic,
      limits: {
        maxStudents: parsed.maxStudents,
        maxStaff: parsed.maxStaff,
        maxBranches: parsed.maxBranches,
        storageGb: parsed.storageGb,
      },
      features,
    });
    setBusy(false);
    if (!res.success) {
      setMsg({ tone: "error", text: res.error.message });
      return;
    }
    setMsg({ tone: "success", text: "Plan saved." });
    reset(defaults);
    reload();
  }

  async function changeStatus(status: "active" | "archived") {
    setMsg(null);
    setBusy(true);
    const res = await setPlanStatusRequest(plan.id, status);
    setBusy(false);
    if (!res.success) {
      setMsg({ tone: "error", text: res.error.message });
      return;
    }
    setMsg({ tone: "success", text: status === "archived" ? "Plan archived." : "Plan activated." });
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/plans">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Package className="size-5 shrink-0 text-primary" />
            <h1 className="truncate text-lg font-semibold text-foreground">{plan.name}</h1>
            <Badge tone={statusTone[plan.status] ?? "neutral"}>{plan.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {plan.code} · {formatPlanPrice(plan.price, plan.currency)}
            {plan.billingInterval === "yearly" ? "/yr" : "/mo"}
          </p>
        </div>
        {manage && (
          <div className="flex gap-xs">
            {plan.status !== "active" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("active")}>
                <CheckCircle2 className="size-3.5" /> Activate
              </Button>
            )}
            {plan.status !== "archived" && (
              <Button size="sm" variant="outline" disabled={busy} onClick={() => changeStatus("archived")}>
                <Archive className="size-3.5" /> Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {msg && (
        <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>
          {msg.text}
        </p>
      )}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Price" value={formatPlanPrice(plan.price, plan.currency)} tone="success" />
        <StatTile label="Interval" value={plan.billingInterval} tone="info" />
        <StatTile label="Students" value={plan.limits.maxStudents === null ? "∞" : plan.limits.maxStudents.toLocaleString("en-IN")} tone="neutral" />
        <StatTile label="Staff" value={plan.limits.maxStaff === null ? "∞" : String(plan.limits.maxStaff)} tone="neutral" />
        <StatTile label="Branches" value={plan.limits.maxBranches === null ? "∞" : String(plan.limits.maxBranches)} tone="neutral" />
        <StatTile label="Storage" value={plan.limits.storageGb === null ? "∞" : `${plan.limits.storageGb} GB`} tone="neutral" />
        <StatTile label="Trial" value={`${plan.trialDays} days`} tone="info" />
        <StatTile label="Support" value={plan.supportLevel ?? "—"} tone="neutral" />
      </div>

      {!manage ? (
        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Feature entitlements</h2>
          <div className="flex flex-wrap gap-xs">
            {plan.features.length === 0 ? (
              <span className="text-sm text-muted-foreground">No features.</span>
            ) : (
              plan.features.map((f) => (
                <Badge key={f} tone="info">{featureLabel(f)}</Badge>
              ))
            )}
          </div>
        </section>
      ) : (
        <form onSubmit={handleSubmit(onSave)} className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
          <h2 className="text-sm font-semibold text-foreground">Edit plan</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" {...register("name")} aria-invalid={!!errors.name} />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="supportLevel">Support level</Label>
              <Input id="supportLevel" {...register("supportLevel")} />
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>

          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <div>
              <Label htmlFor="price">Price *</Label>
              <Input id="price" type="number" step="0.01" {...register("price")} aria-invalid={!!errors.price} />
              <FieldError>{errors.price?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...register("currency")} aria-invalid={!!errors.currency} />
              <FieldError>{errors.currency?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="billingInterval">Interval</Label>
              <select id="billingInterval" {...register("billingInterval")} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <Label htmlFor="trialDays">Trial (days)</Label>
              <Input id="trialDays" type="number" {...register("trialDays")} />
            </div>
          </div>

          <div>
            <p className="mb-xs text-xs font-medium text-muted-foreground">Limits (blank = unlimited)</p>
            <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
              <div>
                <Label htmlFor="maxStudents">Students</Label>
                <Input id="maxStudents" type="number" placeholder="∞" {...register("maxStudents")} />
              </div>
              <div>
                <Label htmlFor="maxStaff">Staff</Label>
                <Input id="maxStaff" type="number" placeholder="∞" {...register("maxStaff")} />
              </div>
              <div>
                <Label htmlFor="maxBranches">Branches</Label>
                <Input id="maxBranches" type="number" placeholder="∞" {...register("maxBranches")} />
              </div>
              <div>
                <Label htmlFor="storageGb">Storage (GB)</Label>
                <Input id="storageGb" type="number" placeholder="∞" {...register("storageGb")} />
              </div>
            </div>
          </div>

          <div>
            <p className="mb-xs text-xs font-medium text-muted-foreground">Features</p>
            <div className="grid grid-cols-2 gap-xs sm:grid-cols-3">
              {FEATURE_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2 rounded-md border border-border p-sm text-sm text-foreground">
                  <input type="checkbox" checked={features.includes(key)} onChange={() => toggleFeature(key)} className="size-4 accent-primary" />
                  {FEATURE_LABELS[key]}
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <div>
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" {...register("sortOrder")} />
            </div>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
              <input type="checkbox" {...register("isPublic")} className="size-4 accent-primary" /> Public
            </label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm text-foreground">
              <input type="checkbox" {...register("whiteLabel")} className="size-4 accent-primary" /> White-label
            </label>
          </div>

          <div className="flex justify-end gap-sm border-t border-border pt-md">
            <Button type="submit" disabled={busy}>
              {busy ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
