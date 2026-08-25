"use client";

import { useState } from "react";
import { Fuel, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportFuel, useTransportVehicles, logFuelEntryRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportFuelLogDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function FuelPage() {
  const { data, loading, error, reload } = useTransportFuel();
  const { data: allVehicles } = useTransportVehicles();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const records = data?.records ?? [];
  const fuelVehicles = (allVehicles ?? []).filter((v) => v.type !== "electric-vehicle");

  const [logOpen, setLogOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometerKm, setOdometerKm] = useState(0);
  const [quantityLitres, setQuantityLitres] = useState(0);
  const [rate, setRate] = useState(96);
  const [vendor, setVendor] = useState("");
  const [filledByName, setFilledByName] = useState("");
  const [fullTank, setFullTank] = useState(true);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport fuel log" role={roleLabels[role]} backHref="/transport" />;
  }
  const canManage = hasServerPermission("transport.manage");

  function openLogFor(vId: string) {
    setVehicleId(vId);
    setOdometerKm(0);
    setFormError(null);
    setLogOpen(true);
  }

  async function submit() {
    setBusy(true);
    setFormError(null);
    const result = await logFuelEntryRequest({ vehicleId, date, odometerKm, quantityLitres, ratePerLitre: rate, vendor: vendor.trim() || undefined, filledByName: filledByName.trim() || undefined, fullTank });
    setBusy(false);
    if (!result.success) {
      setFormError(result.error.message);
      return;
    }
    setLogOpen(false);
    setVendor("");
    setFilledByName("");
    setQuantityLitres(0);
    reload();
  }

  const columns: ColumnDef<TransportFuelLogDto>[] = [
    { id: "vehicle", header: "Vehicle", alwaysVisible: true, sortValue: (f) => f.vehicleRegistration, cell: (f) => <span className="text-sm font-medium text-foreground">{f.vehicleRegistration}</span> },
    { id: "date", header: "Date", cell: (f) => <span className="text-sm text-muted-foreground">{formatDate(f.date)}</span> },
    { id: "quantity", header: "Litres", align: "right", cell: (f) => <span className="text-sm text-foreground">{f.quantityLitres.toFixed(1)} L</span> },
    { id: "cost", header: "Cost", align: "right", cell: (f) => <span className="text-sm text-foreground">{rupees(f.totalCost)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fuel</h1>
          <p className="text-xs text-muted-foreground">Fill-up log and cost tracking</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => openLogFor(fuelVehicles[0]?.id ?? "")}>
            <Plus className="size-3.5" />
            Log fuel entry
          </Button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load fuel log: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading fuel log…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
            <StatTile label="Cost this month" value={rupees(data.insights.costThisMonth)} tone="neutral" />
            <StatTile label="Litres this month" value={data.insights.litresThisMonth.toFixed(0)} tone="neutral" />
            <StatTile label="Fleet fuel vehicles" value={String(data.insights.fuelVehicleCount)} tone="neutral" />
          </div>

          <DataTable
            columns={columns}
            rows={records}
            getRowId={(f) => f.id}
            caption="Fuel log"
            renderMobileCard={(f) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{f.vehicleRegistration}</p>
                  <span className="text-sm text-foreground">{rupees(f.totalCost)}</span>
                </div>
                <p className="text-xs capitalize text-muted-foreground">
                  {f.quantityLitres.toFixed(1)} L · {formatDate(f.date)}
                </p>
              </div>
            )}
            emptyIcon={Fuel}
            emptyTitle="No fuel entries logged"
          />
        </>
      ) : null}

      <DetailDrawer open={logOpen} onOpenChange={setLogOpen} title="Log fuel entry" description="Records a fill-up">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Vehicle</Label>
            <Select value={vehicleId} onValueChange={setVehicleId}>
              <SelectTrigger aria-label="Vehicle">
                <SelectValue placeholder="Select vehicle" />
              </SelectTrigger>
              <SelectContent>
                {fuelVehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.registrationNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="fuel-date">Date</Label>
            <Input id="fuel-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="fuel-odo">Odometer (km)</Label>
            <Input id="fuel-odo" type="number" min={0} value={odometerKm} onChange={(e) => setOdometerKm(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="fuel-qty">Quantity (litres)</Label>
            <Input id="fuel-qty" type="number" min={0} step="0.1" value={quantityLitres} onChange={(e) => setQuantityLitres(Number(e.target.value))} />
          </div>
          <div>
            <Label htmlFor="fuel-rate">Rate per litre (₹)</Label>
            <Input id="fuel-rate" type="number" min={0} value={rate} onChange={(e) => setRate(Number(e.target.value))} />
          </div>
          <p className="text-xs text-muted-foreground">Total: {rupees(Math.round(rate * quantityLitres * 100) / 100)}</p>
          <div>
            <Label htmlFor="fuel-vendor">Vendor</Label>
            <Input id="fuel-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="fuel-filledby">Filled by</Label>
            <Input id="fuel-filledby" value={filledByName} onChange={(e) => setFilledByName(e.target.value)} placeholder="Driver name" />
          </div>
          <div className="flex items-center gap-xs">
            <Checkbox id="fuel-full" checked={fullTank} onCheckedChange={(checked) => setFullTank(checked === true)} />
            <Label htmlFor="fuel-full">Full tank</Label>
          </div>
          {formError && <p className="text-xs text-error">{formError}</p>}
          <Button disabled={!vehicleId || quantityLitres <= 0 || rate <= 0 || busy} onClick={submit}>
            Log entry
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
