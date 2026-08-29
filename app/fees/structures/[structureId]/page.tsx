"use client";

// Real PostgreSQL/API cutover (Phase 9F) — reads GET /api/fees/structures/[id].
import Link from "next/link";
import { use } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FeeTrail } from "@/components/fees/fee-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setFeeStructureStatusRequest, useFeeStructure } from "@/lib/hooks/api/use-fees-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function FeeStructureDetailPage({ params }: { params: Promise<{ structureId: string }> }) {
  const { structureId } = use(params);
  const { data: structure, loading, error, reload } = useFeeStructure(structureId);
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("fees.manage");

  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;

  if (loading && !structure) return <p className="text-sm text-muted-foreground">Loading…</p>;
  if (error || !structure) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ? "Could not load structure" : "Structure not found"}</p>
        <Button asChild variant="outline">
          <Link href="/fees/structures">Back to structures</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <FeeTrail items={[{ label: "Fees", href: "/fees" }, { label: "Fee Setup", href: "/fees/setup" }, { label: "Fee Structure", href: "/fees/structures" }, { label: structure.name }]} />

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{structure.name}</h1>
          <p className="text-xs text-muted-foreground">{structure.classNames.join(", ") || "No classes assigned"}</p>
        </div>
        <div className="flex items-center gap-xs">
          <Badge tone={structure.status === "active" ? "success" : structure.status === "draft" ? "neutral" : "warning"}>{structure.status}</Badge>
          {canManage && structure.status !== "archived" && (
            <Button size="sm" asChild>
              <Link href={`/fees/assignments?structureId=${structure.id}`}>Assign Fees to Students</Link>
            </Button>
          )}
        </div>
      </div>

      {structure.description && <p className="text-sm text-muted-foreground">{structure.description}</p>}

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Fee items</h2>
          <Badge tone="neutral">Total {formatCurrency(structure.totalAmount)}</Badge>
        </div>
        <div className="flex flex-col divide-y divide-border">
          {structure.items.map((item) => (
            <div key={item.id} className="flex items-center justify-between gap-sm py-sm text-sm">
              <div className="min-w-0">
                <p className="truncate font-medium text-foreground">{item.name || item.categoryName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.categoryName} · Due {formatDate(item.dueDate)}
                </p>
              </div>
              <span className="shrink-0 font-medium text-foreground">{formatCurrency(item.amount)}</span>
            </div>
          ))}
          {structure.items.length === 0 && <p className="py-sm text-sm text-muted-foreground">No fee items yet.</p>}
        </div>
      </div>

      {canManage && (
        <div className="flex flex-wrap gap-xs">
          {structure.status === "draft" && (
            <Button size="sm" onClick={() => setFeeStructureStatusRequest(structure.id, "active").then(reload)}>
              Activate
            </Button>
          )}
          {structure.status !== "archived" && (
            <Button size="sm" variant="outline" className="text-error" onClick={() => setFeeStructureStatusRequest(structure.id, "archived").then(reload)}>
              Archive
            </Button>
          )}
          {structure.status === "archived" && (
            <Button size="sm" variant="outline" onClick={() => setFeeStructureStatusRequest(structure.id, "active").then(reload)}>
              Restore to active
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
