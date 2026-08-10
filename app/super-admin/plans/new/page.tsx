"use client";

// Real "Create plan" form (Super Admin SA-4A). Submits to POST /api/super-admin/plans
// — no mock store, no simulation. Prices are entered as major-unit numbers and sent
// structured (price + currency + billingInterval), never as formatted strings.
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, Package } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { createPlanRequest } from "@/lib/hooks/api/use-plans";
import { FEATURE_KEYS, FEATURE_LABELS } from "@/lib/plans/features";

// Client validation is UX only — the server re-validates authoritatively. Empty
// numeric limits mean "unlimited" and are sent as null.
const optionalLimit = z
  .union([z.literal(""), z.coerce.number().int().min(0)])
  .transform((v) => (v === "" ? null : v));

const schema = z.object({
  code: z.string().trim().min(1, "Code is required").max(60),
  name: z.string().trim().min(1, "Name is required").max(120),
  description: z.string().trim().optional().or(z.literal("")),
  price: z.coerce.number({ message: "Enter a price" }).min(0, "Price cannot be negative"),
  currency: z.string().trim().length(3, "3-letter ISO code").default("INR"),
  billingInterval: z.enum(["monthly", "yearly"]),
  trialDays: z.coerce.number().int().min(0),
  status: z.enum(["draft", "active"]),
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

export default function NewPlanPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [features, setFeatures] = useState<string[]>(["students"]);

  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      code: "",
      name: "",
      description: "",
      price: 9999,
      currency: "INR",
      billingInterval: "monthly",
      trialDays: 14,
      status: "draft",
      sortOrder: 0,
      maxStudents: "",
      maxStaff: "",
      maxBranches: "",
      storageGb: "",
      supportLevel: "standard",
      whiteLabel: false,
      isPublic: true,
    },
  });
  const errors = formState.errors;

  function toggleFeature(key: string) {
    setFeatures((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  async function onSubmit(values: Values) {
    setSubmitError(null);
    setSubmitting(true);
    const parsed = schema.parse(values); // apply transforms (limits → null)
    const res = await createPlanRequest({
      code: parsed.code.trim().toUpperCase(),
      name: parsed.name.trim(),
      description: parsed.description?.trim() || undefined,
      price: parsed.price,
      currency: parsed.currency.trim().toUpperCase(),
      billingInterval: parsed.billingInterval,
      trialDays: parsed.trialDays,
      status: parsed.status,
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
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(res.error.message);
      return;
    }
    router.push(`/super-admin/plans/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/plans">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Package className="size-5 text-primary" /> New plan
        </h1>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {submitError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{submitError}</p>}

        <section className="flex flex-col gap-sm">
          <h2 className="text-sm font-semibold text-foreground">Identity</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="code">Code * (unique)</Label>
              <Input id="code" placeholder="GROWTH" {...register("code")} aria-invalid={!!errors.code} />
              <FieldError>{errors.code?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="name">Name *</Label>
              <Input id="name" placeholder="Growth" {...register("name")} aria-invalid={!!errors.name} />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} {...register("description")} />
          </div>
        </section>

        <section className="flex flex-col gap-sm border-t border-border pt-md">
          <h2 className="text-sm font-semibold text-foreground">Pricing</h2>
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
              <Input id="trialDays" type="number" {...register("trialDays")} aria-invalid={!!errors.trialDays} />
              <FieldError>{errors.trialDays?.message}</FieldError>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-sm border-t border-border pt-md">
          <h2 className="text-sm font-semibold text-foreground">Limits</h2>
          <p className="text-xs text-muted-foreground">Leave blank for unlimited.</p>
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
        </section>

        <section className="flex flex-col gap-sm border-t border-border pt-md">
          <h2 className="text-sm font-semibold text-foreground">Features</h2>
          <div className="grid grid-cols-2 gap-xs sm:grid-cols-3">
            {FEATURE_KEYS.map((key) => (
              <label key={key} className="flex items-center gap-2 rounded-md border border-border p-sm text-sm text-foreground">
                <input type="checkbox" checked={features.includes(key)} onChange={() => toggleFeature(key)} className="size-4 accent-primary" />
                {FEATURE_LABELS[key]}
              </label>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-sm border-t border-border pt-md">
          <h2 className="text-sm font-semibold text-foreground">Options</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <div>
              <Label htmlFor="status">Status</Label>
              <select id="status" {...register("status")} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground">
                <option value="draft">Draft</option>
                <option value="active">Active</option>
              </select>
            </div>
            <div>
              <Label htmlFor="supportLevel">Support level</Label>
              <Input id="supportLevel" placeholder="standard" {...register("supportLevel")} />
            </div>
            <div>
              <Label htmlFor="sortOrder">Sort order</Label>
              <Input id="sortOrder" type="number" {...register("sortOrder")} />
            </div>
          </div>
          <div className="flex flex-wrap gap-md pt-xs">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" {...register("isPublic")} className="size-4 accent-primary" /> Public
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input type="checkbox" {...register("whiteLabel")} className="size-4 accent-primary" /> White-label
            </label>
          </div>
        </section>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button type="button" variant="outline" disabled={submitting} onClick={() => router.push("/super-admin/plans")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create plan"}
          </Button>
        </div>
      </form>
    </div>
  );
}
