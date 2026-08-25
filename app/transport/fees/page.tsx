"use client";

import Link from "next/link";
import { AlertTriangle, Wallet } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportFees } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportFeesSummaryDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const rupees = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const statusTone: Record<string, "success" | "warning" | "error" | "neutral"> = { unpaid: "warning", partially_paid: "warning", paid: "success", overdue: "error" };
const statusLabel: Record<string, string> = { unpaid: "Unpaid", partially_paid: "Partially paid", paid: "Paid", overdue: "Overdue" };

type Row = TransportFeesSummaryDto["rows"][number];

export default function TransportFeesPage() {
  const { data, loading, error, reload } = useTransportFees();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport fees" role={roleLabels[role]} backHref="/transport" />;
  }

  const columns: ColumnDef<Row>[] = [
    { id: "student", header: "Student", alwaysVisible: true, sortValue: (r) => r.studentName, cell: (r) => <span className="text-sm font-medium text-foreground">{r.studentName}</span> },
    { id: "item", header: "Item", cell: (r) => <span className="text-sm text-muted-foreground">{r.itemName ?? "Transport fee"}</span> },
    { id: "due", header: "Due", cell: (r) => <span className="text-sm text-muted-foreground">{formatDate(r.dueDate)}</span> },
    { id: "billed", header: "Billed", align: "right", cell: (r) => <span className="text-sm text-foreground">{rupees(r.billedAmount)}</span> },
    { id: "paid", header: "Paid", align: "right", cell: (r) => <span className="text-sm text-muted-foreground">{rupees(r.paidAmount)}</span> },
    { id: "status", header: "Status", align: "right", cell: (r) => <Badge tone={statusTone[r.status] ?? "neutral"}>{statusLabel[r.status] ?? r.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Transport fees</h1>
          <p className="text-xs text-muted-foreground">The &quot;Transport&quot; fee category, from the real Fees &amp; Collections ledger</p>
        </div>
        <div className="flex gap-xs">
          <Button asChild variant="outline" size="sm">
            <Link href="/fees/structures">Manage fee structures</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/fees/collection">Collect payment</Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load transport fees: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading transport fees…</div>
      ) : data && !data.categoryExists ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <Wallet className="size-5" />
          </span>
          <div className="mx-auto flex flex-col gap-1">
            <p className="text-sm font-semibold text-foreground">No &quot;Transport&quot; fee category yet</p>
            <p className="text-sm text-muted-foreground">Create a fee category named &quot;Transport&quot; in Fee Categories, then build a structure and assign it to riders — this view will populate from the real ledger.</p>
          </div>
          <Button asChild size="sm" variant="outline">
            <Link href="/fees/categories">Go to Fee Categories</Link>
          </Button>
        </div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Billed" value={rupees(data.totalBilled)} tone="neutral" />
            <StatTile label="Collected" value={rupees(data.totalCollected)} tone="success" />
            <StatTile label="Outstanding" value={rupees(data.totalOutstanding)} tone={data.totalOutstanding > 0 ? "warning" : "success"} />
            <StatTile label="Overdue charges" value={String(data.overdueChargeCount)} tone={data.overdueChargeCount > 0 ? "error" : "success"} />
          </div>

          {data.overdueChargeCount > 0 && (
            <div className="flex items-start gap-xs rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>{data.overdueChargeCount} transport charge(s) are overdue — collect via the real Fees Collection page.</span>
            </div>
          )}

          <DataTable
            columns={columns}
            rows={data.rows}
            getRowId={(r) => `${r.studentId}-${r.dueDate}-${r.itemName ?? ""}`}
            caption="Transport fee charges"
            renderMobileCard={(r) => (
              <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{r.studentName}</p>
                  <Badge tone={statusTone[r.status] ?? "neutral"}>{statusLabel[r.status] ?? r.status}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  {r.itemName ?? "Transport fee"} · {rupees(r.billedAmount)}
                </p>
              </div>
            )}
            emptyIcon={Wallet}
            emptyTitle="No transport charges billed yet"
          />
        </>
      ) : null}
    </div>
  );
}
