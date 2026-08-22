"use client";

// New inventory item (Phase 9O) — real PostgreSQL/API cutover. Category is
// plain text (no independent category CRUD existed pre-migration); opening
// quantity posts a real OPENING ledger movement.
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createInventoryItemRequest, useInventoryCategories } from "@/lib/hooks/api/use-inventory-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewItemPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: categories } = useInventoryCategories();

  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("piece");
  const [opening, setOpening] = useState("0");
  const [reorder, setReorder] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("inventory.manage")) {
    return <PermissionDenied action="add inventory items" role={roleLabels[role]} backHref="/inventory" />;
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Item name is required.");
    if (!code.trim()) return setError("Code is required.");
    setSubmitting(true);
    const res = await createInventoryItemRequest({
      code: code.trim(), name: name.trim(), category: category.trim() || undefined, unit,
      reorderLevel: Number(reorder) || 0, openingQuantity: Number(opening) || 0,
    });
    setSubmitting(false);
    if (!res.success) return setError(res.error.message);
    router.push(`/inventory/items/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back">
          <Link href="/inventory/items">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="text-lg font-semibold text-foreground">
          Add inventory item
        </h1>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Item name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Code / SKU *</Label>
            <Input id="code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="SKU-0001" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Input id="category" list="category-suggestions" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Stationery" />
            <datalist id="category-suggestions">
              {categories?.map((c) => <option key={c.category} value={c.category} />)}
            </datalist>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit">Unit</Label>
            <Input id="unit" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
          <Field label="Opening qty" value={opening} onChange={setOpening} />
          <Field label="Reorder level" value={reorder} onChange={setReorder} />
        </div>

        {error && (
          <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-xs">
          <Button asChild variant="outline">
            <Link href="/inventory/items">Cancel</Link>
          </Button>
          <Button onClick={submit} disabled={submitting}>
            <PackagePlus className="size-4" /> Create item
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
