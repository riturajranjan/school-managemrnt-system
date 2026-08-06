"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { StatTile } from "@/components/ui/stat-tile";
import { ClassMobileCard, buildClassColumns, classCapacity, useGoToClass } from "@/components/academics/classes/class-table";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { createClass } from "@/lib/services/academics-service";
import { GraduationCap, Layers, Users } from "lucide-react";

export default function ClassesPage() {
  const classes = useManagedClasses();
  const db = useSisStore();
  const goToClass = useGoToClass();
  const { can } = usePermissions();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [order, setOrder] = useState("");
  const [error, setError] = useState("");

  const columns = buildClassColumns(db);
  const activeClasses = classes.filter((c) => c.status === "active");
  const totals = activeClasses.reduce(
    (acc, c) => {
      const { capacity, enrolled } = classCapacity(c);
      return { capacity: acc.capacity + capacity, enrolled: acc.enrolled + enrolled, sections: acc.sections + c.sections.length };
    },
    { capacity: 0, enrolled: 0, sections: 0 },
  );

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
        <StatTile label="Active classes" value={String(activeClasses.length)} icon={GraduationCap} tone="info" />
        <StatTile label="Sections" value={String(totals.sections)} icon={Layers} tone="neutral" />
        <StatTile label="Enrolled" value={String(totals.enrolled)} icon={Users} tone="success" />
        <StatTile label="Total capacity" value={String(totals.capacity)} icon={Users} tone="neutral" />
      </section>

      <DataTable
        columns={columns}
        rows={classes}
        getRowId={(c) => c.id}
        caption="Classes"
        onRowClick={(c) => goToClass(c.id)}
        renderMobileCard={(c) => <ClassMobileCard schoolClass={c} onOpen={() => goToClass(c.id)} />}
        emptyTitle="No classes yet"
        emptyDescription="Add your first class to get started."
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add class" description="Create a new class level">
        <div className="flex flex-col gap-sm">
          {error && <p className="text-xs text-error">{error}</p>}
          <div>
            <Label htmlFor="class-name">Class name</Label>
            <Input id="class-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Class 11" />
          </div>
          <div>
            <Label htmlFor="class-order">Grade order</Label>
            <Input id="class-order" type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder="14" />
          </div>
          <Button
            onClick={() => {
              if (!name.trim()) {
                setError("Class name is required.");
                return;
              }
              const created = createClass(name.trim(), Number(order) || classes.length + 1);
              setCreateOpen(false);
              setName("");
              setOrder("");
              setError("");
              goToClass(created.id);
            }}
          >
            Create class
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
