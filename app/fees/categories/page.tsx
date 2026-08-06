"use client";

import { useState } from "react";
import { Archive, ArchiveRestore, Lock, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useFeeCategories, useFeeStructures } from "@/lib/hooks/use-finance";
import { createFeeCategory, setFeeCategoryStatus } from "@/lib/services/fee-category-service";
import { feeComponentTypeLabels, type FeeCategory, type FeeComponentType } from "@/lib/types/fees";

const componentTypeOptions = Object.keys(feeComponentTypeLabels) as FeeComponentType[];
const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

export default function FeeCategoriesPage() {
  const categories = useFeeCategories();
  const structures = useFeeStructures();
  const { can } = usePermissions();
  const canManage = can("fees.manageStructures");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [componentType, setComponentType] = useState<FeeComponentType>("custom");

  function usageCount(category: FeeCategory) {
    return structures.reduce((sum, s) => sum + s.components.filter((c) => c.type === category.componentType).length, 0);
  }

  const columns: ColumnDef<FeeCategory>[] = [
    {
      id: "name",
      header: "Category",
      alwaysVisible: true,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div>
          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
            {c.name}
            {c.builtIn && <Lock className="size-3 text-muted-foreground" aria-label="Built-in category" />}
          </p>
          {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
        </div>
      ),
    },
    { id: "type", header: "Maps to", cell: (c) => <Badge tone="info">{feeComponentTypeLabels[c.componentType]}</Badge> },
    { id: "usage", header: "Used in structures", cell: (c) => <span className="text-sm text-foreground">{usageCount(c)}</span> },
    { id: "kind", header: "Kind", cell: (c) => <Badge tone={c.builtIn ? "neutral" : "info"}>{c.builtIn ? "Built-in" : "Custom"}</Badge> },
    { id: "status", header: "Status", align: "right", cell: (c) => <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge> },
  ];

  const rowActions: RowAction<FeeCategory>[] = canManage
    ? [
        { key: "archive", label: "Archive", icon: <Archive className="size-3.5" />, hidden: (c) => c.builtIn || c.status !== "active", destructive: true, onSelect: (c) => setFeeCategoryStatus(c.id, "inactive", ACTOR) },
        { key: "restore", label: "Restore", icon: <ArchiveRestore className="size-3.5" />, hidden: (c) => c.builtIn || c.status !== "inactive", onSelect: (c) => setFeeCategoryStatus(c.id, "active", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee categories</h1>
          <p className="text-xs text-muted-foreground">The component registry every fee structure is built from</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add category
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={categories}
        getRowId={(c) => c.id}
        caption="Fee categories"
        rowActions={rowActions}
        renderMobileCard={(c) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-foreground">
                {c.name}
                {c.builtIn && <Lock className="size-3 shrink-0 text-muted-foreground" />}
              </p>
              <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              {feeComponentTypeLabels[c.componentType]} · Used in {usageCount(c)} structure{usageCount(c) === 1 ? "" : "s"}
            </p>
          </div>
        )}
        emptyTitle="No fee categories"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add fee category" description="Create a custom category on top of the built-in registry">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="cat-name">Category name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Uniform fee" />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label>Maps to component type</Label>
            <Select value={componentType} onValueChange={(v) => setComponentType(v as FeeComponentType)}>
              <SelectTrigger aria-label="Component type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {componentTypeOptions.map((t) => (
                  <SelectItem key={t} value={t}>
                    {feeComponentTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              createFeeCategory({ name: name.trim(), description: description.trim() || undefined, componentType }, ACTOR);
              setCreateOpen(false);
              setName("");
              setDescription("");
              setComponentType("custom");
            }}
          >
            Create category
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
