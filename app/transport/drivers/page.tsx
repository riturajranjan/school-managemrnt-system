"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, UserCog } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useDrivers } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { computeDriverSafety } from "@/lib/selectors/driver-safety";
import { createDriver } from "@/lib/services/driver-service";
import { driverStatusLabels, type Driver, type DriverStatus } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

const statusTone: Record<DriverStatus, "success" | "warning" | "error" | "neutral"> = {
  available: "success",
  assigned: "success",
  "on-trip": "success",
  "on-leave": "neutral",
  suspended: "error",
  "license-expired": "error",
  "medical-review": "warning",
  inactive: "neutral",
};

export default function DriversPage() {
  const drivers = useDrivers();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageDrivers");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [phone, setPhone] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [licenseExpiry, setLicenseExpiry] = useState("");
  const [error, setError] = useState<string | null>(null);

  const columns: ColumnDef<Driver>[] = [
    {
      id: "name",
      header: "Driver",
      alwaysVisible: true,
      sortValue: (d) => d.name,
      cell: (d) => (
        <Link href={`/transport/drivers/${d.id}`} className="min-w-0">
          <p className="text-sm font-medium text-foreground underline-offset-2 hover:underline">{d.name}</p>
          <p className="text-xs text-muted-foreground">{d.employeeCode}</p>
        </Link>
      ),
    },
    { id: "license", header: "License", cell: (d) => <span className="text-sm text-muted-foreground">{d.licenseNumber}</span>, defaultVisible: false },
    {
      id: "safety",
      header: "Safety score",
      align: "right",
      sortValue: (d) => computeDriverSafety(db, d).score,
      cell: (d) => {
        const safety = computeDriverSafety(db, d);
        return <span className={`text-sm font-medium ${safety.score >= 80 ? "text-success" : safety.score >= 60 ? "text-warning" : "text-error"}`}>{safety.score}</span>;
      },
    },
    { id: "status", header: "Status", align: "right", cell: (d) => <Badge tone={statusTone[d.status]}>{driverStatusLabels[d.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Drivers</h1>
          <p className="text-xs text-muted-foreground">Driver profiles, licenses and safety score</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add driver
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...drivers].sort((a, b) => a.name.localeCompare(b.name))}
        getRowId={(d) => d.id}
        caption="Drivers"
        renderMobileCard={(d) => {
          const safety = computeDriverSafety(db, d);
          return (
            <Link href={`/transport/drivers/${d.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{d.name}</p>
                <Badge tone={statusTone[d.status]}>{driverStatusLabels[d.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{d.employeeCode}</p>
              <p className={`text-sm font-medium ${safety.score >= 80 ? "text-success" : safety.score >= 60 ? "text-warning" : "text-error"}`}>Safety {safety.score}</p>
            </Link>
          );
        }}
        emptyIcon={UserCog}
        emptyTitle="No drivers yet"
      />

      <DetailDrawer
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setError(null);
        }}
        title="Add driver"
        description="Creates a driver record in available status"
      >
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label htmlFor="drv-name">Full name</Label>
            <Input id="drv-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="drv-code">Employee code</Label>
            <Input id="drv-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="DRV-009" />
          </div>
          <div>
            <Label htmlFor="drv-phone">Phone</Label>
            <Input id="drv-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="drv-license">License number</Label>
            <Input id="drv-license" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="drv-expiry">License expiry</Label>
            <Input id="drv-expiry" type="date" value={licenseExpiry} onChange={(e) => setLicenseExpiry(e.target.value)} />
          </div>
          <Button
            disabled={!name.trim() || !employeeCode.trim() || !phone.trim() || !licenseNumber.trim() || !licenseExpiry}
            onClick={() => {
              const result = createDriver(
                {
                  name: name.trim(),
                  employeeCode: employeeCode.trim(),
                  phone: phone.trim(),
                  joiningDate: new Date().toISOString().slice(0, 10),
                  licenseNumber: licenseNumber.trim(),
                  licenseClass: "Heavy Motor Vehicle",
                  licenseExpiry,
                  backgroundVerified: false,
                  medicalFitnessValid: false,
                  branch: "main",
                },
                ACTOR,
              );
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setCreateOpen(false);
              setName("");
              setEmployeeCode("");
              setPhone("");
              setLicenseNumber("");
              setLicenseExpiry("");
            }}
          >
            Add driver
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
