"use client";

// New asset (Phase 9O). No pre-migration mock had a create form — the mock
// register was seed-data-only. A server-generated, unique assetTag is
// assigned automatically; no depreciation fields (method/useful life/salvage
// value) are collected, since this phase does not fabricate depreciation.
import { useRouter } from "next/navigation";
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackagePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createAssetRequest } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function NewAssetPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();

  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [serialNumber, setSerialNumber] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [cost, setCost] = useState("");
  const [purchaseDate, setPurchaseDate] = useState("");
  const [warrantyUntil, setWarrantyUntil] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("assets.manage")) {
    return <PermissionDenied action="add assets" role={roleLabels[role]} backHref="/assets" />;
  }

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Asset name is required.");
    setSubmitting(true);
    const res = await createAssetRequest({
      name: name.trim(), category: category.trim() || undefined, serialNumber: serialNumber.trim() || undefined,
      manufacturer: manufacturer.trim() || undefined, model: model.trim() || undefined,
      cost: cost ? Number(cost) : undefined, purchaseDate: purchaseDate || undefined, warrantyUntil: warrantyUntil || undefined,
    });
    setSubmitting(false);
    if (!res.success) return setError(res.error.message);
    router.push(`/assets/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back">
          <Link href="/assets/register"><ArrowLeft className="size-4" /></Link>
        </Button>
        <h1 className="text-lg font-semibold text-foreground">Add asset</h1>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Asset name *</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Dell Latitude 5420" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="category">Category</Label>
            <Input id="category" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Laptop" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="serial">Serial number</Label>
            <Input id="serial" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="manufacturer">Manufacturer</Label>
            <Input id="manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="model">Model</Label>
            <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-md sm:grid-cols-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cost">Acquisition cost (₹)</Label>
            <Input id="cost" type="number" inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="purchaseDate">Purchase date</Label>
            <Input id="purchaseDate" type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="warranty">Warranty until</Label>
            <Input id="warranty" type="date" value={warrantyUntil} onChange={(e) => setWarrantyUntil(e.target.value)} />
          </div>
        </div>

        {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

        <div className="flex justify-end gap-xs">
          <Button asChild variant="outline"><Link href="/assets/register">Cancel</Link></Button>
          <Button onClick={submit} disabled={submitting}><PackagePlus className="size-4" /> Create asset</Button>
        </div>
      </div>
    </div>
  );
}
