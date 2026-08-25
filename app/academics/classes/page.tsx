"use client";

// Real classes (Phase 6-pre). Same visual structure (StatTiles + DataTable +
// create drawer) as before, now backed by /api/academics/classes instead of the
// mock store. Rows open the real sections/enrollment surface for that class.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GraduationCap, Layers, Plus, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { CapacityBar } from "@/components/academics/classes/capacity-bar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { createClassRequest, useClasses } from "@/lib/hooks/api/use-academics-foundation";
import type { ColumnDef } from "@/components/data-table/types";
import type { ClassDto } from "@/lib/api/contracts";

const columns: ColumnDef<ClassDto>[] = [
  {
    id: "name", header: "Class", alwaysVisible: true, sortValue: (c) => c.order,
    cell: (c) => (
      <div>
        <p className="text-sm font-medium text-foreground">{c.name}</p>
        <p className="text-xs text-muted-foreground">{c.sectionCount} section{c.sectionCount === 1 ? "" : "s"}</p>
      </div>
    ),
  },
  { id: "sections", header: "Sections", cell: (c) => <span className="text-sm text-foreground">{c.sectionCount || "—"}</span> },
  {
    id: "students", header: "Capacity", sortValue: (c) => c.enrolledCount,
    cell: (c) => <CapacityBar enrolled={c.enrolledCount} capacity={c.capacity} compact />,
  },
  { id: "status", header: "Status", align: "right", cell: (c) => <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge> },
];

export default function ClassesPage() {
  const router = useRouter();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: classes, loading, error, reload } = useClasses();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("academics.view")) {
    return <PermissionDenied action="view classes" role={roleLabels[role]} backHref="/academics" />;
  }

  const active = classes.filter((c) => c.status === "active");
  const totals = active.reduce((acc, c) => ({ capacity: acc.capacity + c.capacity, enrolled: acc.enrolled + c.enrolledCount, sections: acc.sections + c.sectionCount }), { capacity: 0, enrolled: 0, sections: 0 });

  async function create() {
    setBusy(true); setFormError("");
    const res = await createClassRequest({ name: name.trim(), order: order ? Number(order) : undefined });
    setBusy(false);
    if (!res.success) { setFormError(res.error.message); return; }
    setName(""); setOrder(""); setCreateOpen(false); reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Classes</h1>
          <p className="text-xs text-muted-foreground">Class structure, sections and capacity</p>
        </div>
        {can("academics.manageClasses") && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add class
          </Button>
        )}
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Classes" value={String(active.length)} icon={GraduationCap} tone="info" />
        <StatTile label="Sections" value={String(totals.sections)} icon={Layers} tone="neutral" />
        <StatTile label="Enrolled" value={String(totals.enrolled)} icon={Users} tone="success" />
        <StatTile label="Capacity" value={String(totals.capacity)} icon={Users} tone="neutral" />
      </section>

      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load classes: {error}</div>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading classes…</div>}

      {!loading && !error && (
        <DataTable
          columns={columns}
          rows={classes}
          getRowId={(c) => c.id}
          caption="Classes"
          onRowClick={(c) => router.push(`/academics/sections?classId=${c.id}`)}
          emptyTitle="No classes yet"
          renderMobileCard={(c) => (
            <button type="button" onClick={() => router.push(`/academics/sections?classId=${c.id}`)} className="surface-3d flex w-full min-h-11 flex-col gap-1.5 rounded-lg border border-border bg-surface p-sm text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]">
              <div className="flex items-center justify-between gap-xs">
                <p className="text-sm font-semibold text-foreground">{c.name}</p>
                <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
              </div>
              <CapacityBar enrolled={c.enrolledCount} capacity={c.capacity} />
              <p className="truncate text-xs text-muted-foreground">{c.sectionCount} section{c.sectionCount === 1 ? "" : "s"}</p>
            </button>
          )}
        />
      )}

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add class" description="Create a new class in the current academic session">
        <div className="flex flex-col gap-sm">
          {formError && <p className="text-xs text-error">{formError}</p>}
          <div>
            <Label htmlFor="class-name">Class name</Label>
            <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Grade 5" />
          </div>
          <div>
            <Label htmlFor="class-order">Order</Label>
            <Input id="class-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="e.g. 5" />
          </div>
          <Button disabled={busy || !name.trim()} onClick={() => void create()}>Add class</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
