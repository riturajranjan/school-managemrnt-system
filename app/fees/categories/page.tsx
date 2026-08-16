"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads/writes the live
// /api/fees/categories endpoint. Real FeeCategory rows are fully admin-
// defined (no built-in/custom split, no fixed component-type enum) — a
// simplification over the old mock's hybrid registry, not a missing feature.
import { useState } from "react";
import { Archive, ArchiveRestore, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createFeeCategoryRequest, updateFeeCategoryRequest, useFeeCategories } from "@/lib/hooks/api/use-fees-api";
import type { FeeCategoryDto } from "@/lib/api/contracts";

export default function FeeCategoriesPage() {
  const { data: categories, loading, error, reload } = useFeeCategories(true);
  const { can } = usePermissions();
  const canManage = can("fees.manage");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const columns: ColumnDef<FeeCategoryDto>[] = [
    {
      id: "name",
      header: "Category",
      alwaysVisible: true,
      sortValue: (c) => c.name,
      cell: (c) => (
        <div>
          <p className="text-sm font-medium text-foreground">{c.name}</p>
          {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
        </div>
      ),
    },
    { id: "code", header: "Code", cell: (c) => <Badge tone="info">{c.code}</Badge> },
    { id: "status", header: "Status", align: "right", cell: (c) => <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge> },
  ];

  const rowActions: RowAction<FeeCategoryDto>[] = canManage
    ? [
        { key: "archive", label: "Archive", icon: <Archive className="size-3.5" />, hidden: (c) => c.status !== "active", destructive: true, onSelect: (c) => updateFeeCategoryRequest(c.id, { status: "archived" }).then(reload) },
        { key: "restore", label: "Restore", icon: <ArchiveRestore className="size-3.5" />, hidden: (c) => c.status !== "archived", onSelect: (c) => updateFeeCategoryRequest(c.id, { status: "active" }).then(reload) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee categories</h1>
          <p className="text-xs text-muted-foreground">The category registry every fee structure is built from</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add category
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && categories.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={categories}
        getRowId={(c) => c.id}
        caption="Fee categories"
        rowActions={rowActions}
        renderMobileCard={(c) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{c.name}</p>
              <Badge tone={c.status === "active" ? "success" : "neutral"}>{c.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Code: {c.code}</p>
          </div>
        )}
        emptyTitle="No fee categories"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add fee category" description="Create a category to build fee structures from">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="cat-name">Category name</Label>
            <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tuition fee" />
          </div>
          <div>
            <Label htmlFor="cat-code">Code</Label>
            <Input id="cat-code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="e.g. TUITION" />
          </div>
          <div>
            <Label htmlFor="cat-desc">Description</Label>
            <Input id="cat-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <Button
            disabled={!name.trim() || !code.trim()}
            onClick={async () => {
              setFormError(null);
              const res = await createFeeCategoryRequest({ name: name.trim(), code: code.trim(), description: description.trim() || undefined });
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              setName("");
              setCode("");
              setDescription("");
              reload();
            }}
          >
            Create category
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
