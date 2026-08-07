"use client";

import Link from "next/link";
import { Warehouse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";

export default function InventoryVendorsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("inventory.view")) return <PermissionDenied action="view vendors" role={roleLabels[role]} backHref="/inventory" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Vendors</h1>
        <p className="text-xs text-muted-foreground">Shared supplier directory — reuses the Phase 5 accounting vendor register</p>
      </div>

      {db.vendors.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Warehouse className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No vendors registered. Manage vendors in Accounting.</p>
          <Link href="/accounting/vendors" className="text-sm text-primary underline underline-offset-2">Go to Accounting vendors</Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {db.vendors.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{v.name}</p>
                <p className="truncate text-xs text-muted-foreground">{v.contactPerson ?? "—"}{v.phone ? ` · ${v.phone}` : ""}</p>
              </div>
              <Badge tone={v.status === "active" ? "success" : "neutral"}>{v.status}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
