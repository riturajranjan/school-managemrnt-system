"use client";

import Link from "next/link";
import { AlertTriangle, HardDrive, ShieldCheck, TrendingDown, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { assetSummary } from "@/lib/selectors/asset-brief";
import { roleLabels } from "@/lib/permissions/roles";
import { formatMoney } from "@/lib/finance/money";
import { assetStatusLabels } from "@/lib/types/assets";
import { formatDate } from "@/lib/utils";

export default function AssetsDashboardPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const { activeSession } = useShell();
  if (!can("assets.view")) return <PermissionDenied action="view assets" role={roleLabels[role]} backHref="/" />;

  const summary = assetSummary(db);
  const today = new Date().toISOString().slice(0, 10);
  const maintenanceDue = db.assetMaintenance.filter((m) => m.status === "due" || m.status === "overdue" || m.status === "in-progress").slice(0, 6);
  const assetName = (id: string) => db.assets.find((a) => a.id === id)?.name ?? id;
  const warranties = db.assets.filter((a) => a.warrantyExpiry && a.warrantyExpiry >= today).sort((a, b) => (a.warrantyExpiry ?? "").localeCompare(b.warrantyExpiry ?? "")).slice(0, 6);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset Command Centre</h1>
        <p className="text-xs text-muted-foreground">Main branch · {activeSession} · {formatDate(today)}</p>
      </div>

      <section aria-label="Asset summary" className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total assets" value={String(summary.total)} icon={HardDrive} tone="neutral" />
        <StatTile label="Book value" value={formatMoney(summary.bookValue, { compact: true })} icon={TrendingDown} tone="neutral" />
        <StatTile label="Assigned" value={String(summary.assigned)} icon={Users} tone="success" />
        <StatTile label="Available" value={String(summary.available)} icon={HardDrive} tone="neutral" />
        <StatTile label="Under maintenance" value={String(summary.underMaintenance)} icon={Wrench} tone={summary.underMaintenance > 0 ? "warning" : "success"} />
        <StatTile label="Maintenance due" value={String(summary.maintenanceDue)} icon={AlertTriangle} tone={summary.maintenanceDue > 0 ? "warning" : "success"} />
        <StatTile label="Warranty <60d" value={String(summary.warrantyExpiringSoon)} icon={ShieldCheck} tone={summary.warrantyExpiringSoon > 0 ? "warning" : "success"} />
        <StatTile label="Disposed" value={String(summary.disposed)} icon={HardDrive} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Maintenance to action</h2>
          {maintenanceDue.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No maintenance pending.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {maintenanceDue.map((m) => (
                <li key={m.id}>
                  <Link href="/assets/maintenance" className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="truncate text-sm text-foreground">{assetName(m.assetId)}</span>
                    <Badge tone={m.status === "overdue" ? "error" : "warning"}>{m.type}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Upcoming warranty expiries</h2>
          {warranties.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No warranties on record.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {warranties.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-sm text-sm">
                  <Link href={`/assets/${a.id}`} className="truncate text-foreground hover:underline">{a.name}</Link>
                  <Badge tone="neutral">{formatDate(a.warrantyExpiry!)} · {assetStatusLabels[a.status]}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
