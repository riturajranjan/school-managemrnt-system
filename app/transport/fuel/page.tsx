"use client";

import { useState } from "react";
import { Fuel, Plus, TriangleAlert } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useVehicles } from "@/lib/hooks/use-transport";
import { formatMoney, moneyFromMajor, multiplyMoney } from "@/lib/finance/money";
import { useSisStore } from "@/lib/hooks/use-store";
import { fuelInsights } from "@/lib/selectors/fuel-insights";
import { logFuelEntry } from "@/lib/services/fuel-service";
import { fuelTypeLabels, type FuelRecord, type FuelType } from "@/lib/types/transport";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Transport Office", role: "Transport Manager" };

export default function FuelPage() {
  const db = useSisStore();
  const vehicles = useVehicles();
  const { can } = usePermissions();
  const canManage = can("transport.manageFuel");

  const insights = fuelInsights(db);
  const fuelVehicles = vehicles.filter((v) => v.fuelType !== "electric");

  const [logOpen, setLogOpen] = useState(false);
  const [vehicleId, setVehicleId] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [odometerKm, setOdometerKm] = useState(0);
  const [quantityLitres, setQuantityLitres] = useState(0);
  const [rate, setRate] = useState(96);
  const [vendor, setVendor] = useState("");
  const [filledBy, setFilledBy] = useState("");
  const [fullTank, setFullTank] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function vehicleName(id: string) {
    return vehicles.find((v) => v.id === id)?.registrationNumber ?? id;
  }

  function openLogFor(vId: string) {
    const vehicle = vehicles.find((v) => v.id === vId);
    setVehicleId(vId);
    setOdometerKm(vehicle?.odometerKm ?? 0);
    setError(null);
    setLogOpen(true);
  }

  function submit() {
    const totalCost = multiplyMoney(moneyFromMajor(rate, "INR"), quantityLitres);
    const result = logFuelEntry(
      { vehicleId, date, odometerKm, quantityLitres, fuelType: fuelVehicles.find((v) => v.id === vehicleId)?.fuelType as FuelType, rate: moneyFromMajor(rate, "INR"), totalCost, vendor: vendor.trim() || undefined, filledBy, fullTank },
      ACTOR,
    );
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setLogOpen(false);
    setVendor("");
    setFilledBy("");
    setQuantityLitres(0);
  }

  const columns: ColumnDef<FuelRecord>[] = [
    {
      id: "vehicle",
      header: "Vehicle",
      alwaysVisible: true,
      sortValue: (f) => vehicleName(f.vehicleId),
      cell: (f) => (
        <div>
          <p className="text-sm font-medium text-foreground">{vehicleName(f.vehicleId)}</p>
          <p className="text-xs capitalize text-muted-foreground">{fuelTypeLabels[f.fuelType]}</p>
        </div>
      ),
    },
    { id: "date", header: "Date", cell: (f) => <span className="text-sm text-muted-foreground">{formatDate(f.date)}</span> },
    { id: "quantity", header: "Litres", align: "right", cell: (f) => <span className="text-sm text-foreground">{f.quantityLitres.toFixed(1)} L</span> },
    { id: "cost", header: "Cost", align: "right", cell: (f) => <span className="text-sm text-foreground">{formatMoney(f.totalCost)}</span> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fuel</h1>
          <p className="text-xs text-muted-foreground">Fill-up log, efficiency and cost tracking</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => openLogFor(fuelVehicles[0]?.id ?? "")}>
            <Plus className="size-3.5" />
            Log fuel entry
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Cost this month" value={formatMoney(insights.totalCostThisMonth, { compact: true })} tone="neutral" />
        <StatTile label="Litres this month" value={insights.totalLitresThisMonth.toFixed(0)} tone="neutral" />
        <StatTile label="Fleet fuel vehicles" value={String(fuelVehicles.length)} tone="neutral" />
        <StatTile label="Efficiency anomalies" value={String(insights.anomalies.length)} tone={insights.anomalies.length > 0 ? "error" : "success"} />
      </div>

      {insights.anomalies.length > 0 && (
        <div className="flex items-start gap-xs rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span>
            {insights.anomalies.length} fill-up(s) show mileage well below the vehicle&apos;s own average — worth checking for leaks or pilferage:{" "}
            {insights.anomalies.map((a) => vehicleName(a.vehicleId)).join(", ")}
          </span>
        </div>
      )}

      {insights.leastEfficientVehicles.length > 0 && (
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="mb-xs text-xs font-medium text-muted-foreground">Least efficient vehicles</p>
          <div className="flex flex-wrap gap-xs">
            {insights.leastEfficientVehicles.map((v) => (
              <Badge key={v.vehicleId} tone="neutral">
                {vehicleName(v.vehicleId)} · {v.avgKmpl.toFixed(1)} km/L
              </Badge>
            ))}
          </div>
        </div>
      )}

      <DataTable
        columns={columns}
        rows={[...db.fuelRecords].sort((a, b) => (a.date < b.date ? 1 : -1))}
        getRowId={(f) => f.id}
        caption="Fuel log"
        renderMobileCard={(f) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{vehicleName(f.vehicleId)}</p>
              <span className="text-sm text-foreground">{formatMoney(f.totalCost)}</span>
            </div>
            <p className="text-xs capitalize text-muted-foreground">
              {f.quantityLitres.toFixed(1)} L · {formatDate(f.date)}
            </p>
          </div>
        )}
        emptyIcon={Fuel}
        emptyTitle="No fuel entries logged"
      />

      <DetailDrawer open={logOpen} onOpenChange={setLogOpen} title="Log fuel entry" description="Records a fill-up and advances the vehicle's odometer">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Vehicle</Label>
            <Select
              value={vehicleId}
              onValueChange={(v) => {
                setVehicleId(v);
                setOdometerKm(vehicles.find((veh) => veh.id === v)?.odometerKm ?? 0);
              }}
            >
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
          <p className="text-xs text-muted-foreground">Total: {formatMoney(multiplyMoney(moneyFromMajor(rate, "INR"), quantityLitres))}</p>
          <div>
            <Label htmlFor="fuel-vendor">Vendor</Label>
            <Input id="fuel-vendor" value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="fuel-filledby">Filled by</Label>
            <Input id="fuel-filledby" value={filledBy} onChange={(e) => setFilledBy(e.target.value)} placeholder="Driver name" />
          </div>
          <div className="flex items-center gap-xs">
            <Checkbox id="fuel-full" checked={fullTank} onCheckedChange={(checked) => setFullTank(checked === true)} />
            <Label htmlFor="fuel-full">Full tank</Label>
          </div>
          {error && <p className="text-xs text-error">{error}</p>}
          <Button disabled={!vehicleId || quantityLitres <= 0 || !filledBy.trim()} onClick={submit}>
            Log entry
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
