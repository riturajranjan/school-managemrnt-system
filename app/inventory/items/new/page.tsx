"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createItem } from "@/lib/services/inventory-service";
import { moneyFromMajor } from "@/lib/finance/money";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewItemPage() {
  const db = useSisStore();
  const router = useRouter();
  const { can, role } = usePermissions();

  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [categoryId, setCategoryId] = useState(
    db.inventoryCategories[0]?.id ?? "",
  );
  const [unit, setUnit] = useState("piece");
  const [opening, setOpening] = useState("0");
  const [minimum, setMinimum] = useState("10");
  const [reorder, setReorder] = useState("20");
  const [maximum, setMaximum] = useState("500");
  const [cost, setCost] = useState("50");
  const [error, setError] = useState<string | null>(null);

  if (!can("inventory.manageItems"))
    return (
      <PermissionDenied
        action="add inventory items"
        role={roleLabels[role]}
        backHref="/inventory"
      />
    );

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Item name is required.");
    if (!sku.trim()) return setError("SKU is required.");
    const result = createItem(
      {
        branch: "main",
        name: name.trim(),
        sku: sku.trim(),
        categoryId,
        unit,
        minimumLevel: Number(minimum) || 0,
        reorderLevel: Number(reorder) || 0,
        maximumLevel: Number(maximum) || 0,
        unitCost: moneyFromMajor(Number(cost) || 0, "INR"),
        taxPercent: 18,
        openingQuantity: Number(opening) || 0,
      },
      { name: "Storekeeper", role: roleLabels[role] },
    );
    if (!result.ok) return setError(result.error);
    router.push(`/inventory/items/${result.item!.id}`);
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
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sku">SKU *</Label>
            <Input
              id="sku"
              value={sku}
              onChange={(e) => setSku(e.target.value)}
              placeholder="SKU-0001"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Category</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {db.inventoryCategories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="unit">Unit</Label>
            <Input
              id="unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
          <Field label="Opening qty" value={opening} onChange={setOpening} />
          <Field label="Minimum" value={minimum} onChange={setMinimum} />
          <Field label="Reorder" value={reorder} onChange={setReorder} />
          <Field label="Maximum" value={maximum} onChange={setMaximum} />
        </div>
        <div className="sm:w-40">
          <Field label="Unit cost (₹)" value={cost} onChange={setCost} />
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
          <Button onClick={submit}>
            <PackagePlus className="size-4" /> Create item
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
