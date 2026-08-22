"use client";

// Asset Command Centre (Phase 9O) — real PostgreSQL/API cutover. `totalCost`
// is a plain sum of admin-entered acquisition prices — never a fabricated
// depreciated book value.
import Link from "next/link";
import { AlertTriangle, HardDrive, ShieldCheck, TrendingDown, Users, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { useShell } from "@/components/shell/shell-context";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAssetDashboard } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function AssetsDashboardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { activeSession } = useShell();
  const { data: summary } = useAssetDashboard();

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view assets" role={roleLabels[role]} backHref="/" />;
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset Command Centre</h1>
        <p className="text-xs text-muted-foreground">{activeSession} · {formatDate(today)}</p>
      </div>

      <section aria-label="Asset summary" className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Total assets" value={String(summary?.total ?? 0)} icon={HardDrive} tone="neutral" />
        <StatTile label="Total cost" value={`₹${(summary?.totalCost ?? 0).toLocaleString("en-IN")}`} icon={TrendingDown} tone="neutral" />
        <StatTile label="Assigned" value={String(summary?.assigned ?? 0)} icon={Users} tone="success" />
        <StatTile label="Available" value={String(summary?.available ?? 0)} icon={HardDrive} tone="neutral" />
        <StatTile label="Under maintenance" value={String(summary?.maintenance ?? 0)} icon={Wrench} tone={(summary?.maintenance ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Lost / damaged" value={String((summary?.lost ?? 0) + (summary?.damaged ?? 0))} icon={AlertTriangle} tone={(summary?.lost ?? 0) + (summary?.damaged ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Warranty <60d" value={String(summary?.warrantyExpiringSoon.length ?? 0)} icon={ShieldCheck} tone={(summary?.warrantyExpiringSoon.length ?? 0) > 0 ? "warning" : "success"} />
        <StatTile label="Retired" value={String(summary?.retired ?? 0)} icon={HardDrive} tone="neutral" />
      </section>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Maintenance to action</h2>
          {(summary?.maintenanceOpen ?? []).length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No maintenance pending.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {summary!.maintenanceOpen.map((m) => (
                <li key={m.id}>
                  <Link href={`/assets/${m.assetId}`} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm hover:border-primary/40">
                    <span className="truncate text-sm text-foreground">{m.assetName}</span>
                    <Badge tone="warning">{m.type}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Upcoming warranty expiries</h2>
          {(summary?.warrantyExpiringSoon ?? []).length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No warranties on record.</p>
          ) : (
            <ul className="flex flex-col gap-xs">
              {summary!.warrantyExpiringSoon.map((a) => (
                <li key={a.id} className="flex items-center justify-between gap-sm text-sm">
                  <Link href={`/assets/${a.id}`} className="truncate text-foreground hover:underline">{a.name}</Link>
                  <Badge tone="neutral">{formatDate(a.warrantyUntil)}</Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
