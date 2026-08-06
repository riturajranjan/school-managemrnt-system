"use client";

import { useState } from "react";
import { Plus, Store, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createVendor, setVendorStatus } from "@/lib/services/vendor-service";
import { expenseCategoryLabels, type ExpenseCategory, type Vendor } from "@/lib/types/accounting";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };
const categoryOptions = Object.keys(expenseCategoryLabels) as ExpenseCategory[];

export default function VendorsPage() {
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("accounting.manageVendors");

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("academic-materials");

  const columns: ColumnDef<Vendor>[] = [
    {
      id: "name",
      header: "Vendor",
      alwaysVisible: true,
      sortValue: (v) => v.name,
      cell: (v) => (
        <div>
          <p className="text-sm font-medium text-foreground">{v.name}</p>
          <p className="text-xs text-muted-foreground">{v.contactPerson ?? "—"}</p>
        </div>
      ),
    },
    { id: "categories", header: "Categories", cell: (v) => <span className="text-sm text-muted-foreground">{v.categories.map((c) => expenseCategoryLabels[c]).join(", ")}</span> },
    { id: "phone", header: "Phone", cell: (v) => <span className="text-sm text-muted-foreground">{v.phone ?? "—"}</span>, defaultVisible: false },
    { id: "rating", header: "Rating", cell: (v) => <span className="text-sm text-foreground">{v.rating ? `${v.rating}/5` : "—"}</span> },
    { id: "status", header: "Status", align: "right", cell: (v) => <Badge tone={v.status === "active" ? "success" : "neutral"}>{v.status === "active" ? "Active" : "Inactive"}</Badge> },
  ];

  const rowActions: RowAction<Vendor>[] = canManage
    ? [
        { key: "deactivate", label: "Deactivate", icon: <XCircle className="size-3.5" />, hidden: (v) => v.status !== "active", destructive: true, onSelect: (v) => setVendorStatus(v.id, "inactive", ACTOR) },
        { key: "activate", label: "Reactivate", icon: <Store className="size-3.5" />, hidden: (v) => v.status !== "inactive", onSelect: (v) => setVendorStatus(v.id, "active", ACTOR) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Vendors</h1>
          <p className="text-xs text-muted-foreground">Vendor directory used across expenses and purchase orders</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="size-3.5" />
            Add vendor
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={db.vendors}
        getRowId={(v) => v.id}
        caption="Vendors"
        rowActions={rowActions}
        renderMobileCard={(v) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
              <Badge tone={v.status === "active" ? "success" : "neutral"}>{v.status === "active" ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{v.categories.map((c) => expenseCategoryLabels[c]).join(", ")}</p>
          </div>
        )}
        emptyIcon={Store}
        emptyTitle="No vendors yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add vendor" description="Available for expenses and purchase orders once created">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="vendor-name">Vendor name</Label>
            <Input id="vendor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bright Stationers Pvt Ltd" />
          </div>
          <div>
            <Label htmlFor="vendor-contact">Contact person</Label>
            <Input id="vendor-contact" value={contactPerson} onChange={(e) => setContactPerson(e.target.value)} placeholder="Optional" />
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="vendor-phone">Phone</Label>
              <Input id="vendor-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" />
            </div>
            <div>
              <Label htmlFor="vendor-email">Email</Label>
              <Input id="vendor-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div>
            <Label>Primary category</Label>
            <Select value={category} onValueChange={(v) => setCategory(v as ExpenseCategory)}>
              <SelectTrigger aria-label="Primary category">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c} value={c}>
                    {expenseCategoryLabels[c]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={!name.trim()}
            onClick={() => {
              createVendor({ name: name.trim(), contactPerson: contactPerson.trim() || undefined, phone: phone.trim() || undefined, email: email.trim() || undefined, categories: [category] }, ACTOR);
              setCreateOpen(false);
              setName("");
              setContactPerson("");
              setPhone("");
              setEmail("");
            }}
          >
            Add vendor
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
