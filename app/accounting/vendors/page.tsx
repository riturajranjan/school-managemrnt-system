"use client";

// Real PostgreSQL/API cutover (Production Accounting checkpoint) — reads/
// writes the live /api/accounting/vendors endpoint. No vendor balance/payable
// field exists anywhere here: this checkpoint implements no accounts-payable
// ledger, so a "balance" column would be fabricated. There is no delete
// action — Deactivate/Reactivate (status) is the only removal path.
import { useState } from "react";
import { Plus, Store, XCircle } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef, RowAction } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createVendorRequest, updateVendorRequest, useVendors } from "@/lib/hooks/api/use-accounting-api";
import type { VendorDto } from "@/lib/api/contracts";
import { roleLabels } from "@/lib/permissions/roles";

export default function VendorsPage() {
  const { data: vendors, loading, error, reload } = useVendors({ pageSize: 100 });
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("accounting.manage");

  const [createOpen, setCreateOpen] = useState(false);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [contactPerson, setContactPerson] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [taxId, setTaxId] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("accounting.view")) return <PermissionDenied action="view the accounting module" role={roleLabels[role]} backHref="/accounting" />;

  function resetForm() {
    setCode(""); setName(""); setContactPerson(""); setPhone(""); setEmail(""); setAddress(""); setTaxId(""); setFormError(null);
  }

  const columns: ColumnDef<VendorDto>[] = [
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
    { id: "code", header: "Code", cell: (v) => <span className="text-sm text-muted-foreground">{v.code}</span> },
    { id: "phone", header: "Phone", cell: (v) => <span className="text-sm text-muted-foreground">{v.phone ?? "—"}</span> },
    { id: "email", header: "Email", cell: (v) => <span className="text-sm text-muted-foreground">{v.email ?? "—"}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (v) => <Badge tone={v.status === "active" ? "success" : "neutral"}>{v.status === "active" ? "Active" : "Inactive"}</Badge> },
  ];

  const rowActions: RowAction<VendorDto>[] = canManage
    ? [
        { key: "deactivate", label: "Deactivate", icon: <XCircle className="size-3.5" />, hidden: (v) => v.status !== "active", destructive: true, onSelect: (v) => updateVendorRequest(v.id, { status: "inactive" }).then(reload) },
        { key: "activate", label: "Reactivate", icon: <Store className="size-3.5" />, hidden: (v) => v.status !== "inactive", onSelect: (v) => updateVendorRequest(v.id, { status: "active" }).then(reload) },
      ]
    : [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Vendors</h1>
          <p className="text-xs text-muted-foreground">Vendor directory used across purchase orders</p>
        </div>
        {canManage && (
          <Button
            size="sm"
            onClick={() => {
              resetForm();
              setCreateOpen(true);
            }}
          >
            <Plus className="size-3.5" />
            Add vendor
          </Button>
        )}
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
      {loading && vendors.length === 0 && <p className="text-xs text-muted-foreground">Loading…</p>}

      <DataTable
        columns={columns}
        rows={vendors}
        getRowId={(v) => v.id}
        caption="Vendors"
        rowActions={rowActions}
        renderMobileCard={(v) => (
          <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{v.name}</p>
              <Badge tone={v.status === "active" ? "success" : "neutral"}>{v.status === "active" ? "Active" : "Inactive"}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{v.code} · {v.contactPerson ?? "No contact on file"}</p>
          </div>
        )}
        emptyIcon={Store}
        emptyTitle="No vendors yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="Add vendor" description="Available for purchase orders once created">
        <div className="flex flex-col gap-sm">
          {formError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{formError}</p>}
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="vendor-code">Vendor code</Label>
              <Input id="vendor-code" value={code} onChange={(e) => setCode(e.target.value)} placeholder="e.g. VEND-001" />
            </div>
            <div>
              <Label htmlFor="vendor-name">Vendor name</Label>
              <Input id="vendor-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bright Stationers Pvt Ltd" />
            </div>
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
            <Label htmlFor="vendor-address">Address</Label>
            <Input id="vendor-address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="vendor-tax-id">Tax ID</Label>
            <Input id="vendor-tax-id" value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="Optional" />
          </div>
          <Button
            disabled={!code.trim() || !name.trim() || saving}
            onClick={async () => {
              setFormError(null);
              setSaving(true);
              const res = await createVendorRequest({
                code: code.trim(), name: name.trim(),
                contactPerson: contactPerson.trim() || undefined, phone: phone.trim() || undefined,
                email: email.trim() || undefined, address: address.trim() || undefined, taxId: taxId.trim() || undefined,
              });
              setSaving(false);
              if (!res.success) {
                setFormError(res.error.message);
                return;
              }
              setCreateOpen(false);
              resetForm();
              reload();
            }}
          >
            Add vendor
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
