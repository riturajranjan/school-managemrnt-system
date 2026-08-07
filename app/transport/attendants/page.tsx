"use client";

import { useState } from "react";
import { Plus, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAttendants } from "@/lib/hooks/use-transport";
import { useSisStore } from "@/lib/hooks/use-store";
import { createAttendant, setAttendantStatus } from "@/lib/services/attendant-service";
import { attendantStatusLabels, type Attendant, type AttendantStatus } from "@/lib/types/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

const statusTone: Record<AttendantStatus, "success" | "warning" | "error" | "neutral"> = {
  available: "success",
  assigned: "success",
  "on-trip": "success",
  "on-leave": "neutral",
  inactive: "neutral",
};

export default function AttendantsPage() {
  const attendants = useAttendants();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("transport.manageAttendants");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [phone, setPhone] = useState("");

  function routeFor(attendantId: string) {
    return db.transportRoutes.find((r) => r.attendantId === attendantId);
  }

  const columns: ColumnDef<Attendant>[] = [
    {
      id: "name",
      header: "Attendant",
      alwaysVisible: true,
      sortValue: (a) => a.name,
      cell: (a) => (
        <div>
          <p className="text-sm font-medium text-foreground">{a.name}</p>
          <p className="text-xs text-muted-foreground">{a.employeeCode}</p>
        </div>
      ),
    },
    { id: "route", header: "Route", cell: (a) => <span className="text-sm text-muted-foreground">{routeFor(a.id)?.name ?? "—"}</span> },
    { id: "phone", header: "Phone", cell: (a) => <span className="text-sm text-muted-foreground">{a.phone}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (a) => <Badge tone={statusTone[a.status]}>{attendantStatusLabels[a.status]}</Badge> },
  ];

  const rowActions: RowAction<Attendant>[] = canManage
    ? [
        { key: "leave", label: "Mark on leave", hidden: (a) => a.status === "on-leave", onSelect: (a) => setAttendantStatus(a.id, "on-leave", ACTOR) },
        { key: "available", label: "Mark available", hidden: (a) => a.status === "available", onSelect: (a) => setAttendantStatus(a.id, "available", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Attendants</h1>
          <p className="text-xs text-muted-foreground">Attendant profiles and route assignments</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add attendant
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={[...attendants].sort((a, b) => a.name.localeCompare(b.name))}
        getRowId={(a) => a.id}
        caption="Attendants"
        rowActions={rowActions}
        renderMobileCard={(a) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{a.name}</p>
              <Badge tone={statusTone[a.status]}>{attendantStatusLabels[a.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {a.employeeCode} · {routeFor(a.id)?.name ?? "No route"}
            </p>
          </div>
        )}
        emptyIcon={Users}
        emptyTitle="No attendants yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add attendant" description="Creates an attendant record in available status">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="att-name">Full name</Label>
            <Input id="att-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="att-code">Employee code</Label>
            <Input id="att-code" value={employeeCode} onChange={(e) => setEmployeeCode(e.target.value)} placeholder="ATT-006" />
          </div>
          <div>
            <Label htmlFor="att-phone">Phone</Label>
            <Input id="att-phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <Button
            disabled={!name.trim() || !employeeCode.trim() || !phone.trim()}
            onClick={() => {
              createAttendant({ name: name.trim(), employeeCode: employeeCode.trim(), phone: phone.trim(), joiningDate: new Date().toISOString().slice(0, 10), branch: "main" }, ACTOR);
              setCreateOpen(false);
              setName("");
              setEmployeeCode("");
              setPhone("");
            }}
          >
            Add attendant
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
