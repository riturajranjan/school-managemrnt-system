"use client";

// Asset reports (Phase 9O) — real PostgreSQL/API cutover. Register + cost/
// warranty distribution are real; depreciation is dropped (not fabricated).
import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAssetDashboard, useAssets } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import { downloadTextFile } from "@/lib/utils";

export default function AssetReportsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: summary } = useAssetDashboard();
  const { data: assets } = useAssets();

  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view asset reports" role={roleLabels[role]} backHref="/assets" />;

  const byCategory = new Map<string, { count: number; cost: number }>();
  for (const a of assets.filter((x) => x.status !== "retired")) {
    const key = a.category ?? "Uncategorized";
    const entry = byCategory.get(key) ?? { count: 0, cost: 0 };
    entry.count += 1;
    entry.cost += a.cost ?? 0;
    byCategory.set(key, entry);
  }
  const categoryRows = [...byCategory.entries()].sort((a, b) => b[1].cost - a[1].cost);
  const maxCost = Math.max(1, ...categoryRows.map(([, v]) => v.cost));

  function exportRegister() {
    const lines = ["Asset,Tag,Category,Status,Cost,Holder/Location"];
    for (const a of assets) {
      lines.push([a.name, a.assetTag, a.category ?? "", a.status, a.cost ?? "", a.assignedToName ?? a.locationName ?? ""].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    downloadTextFile("asset-register.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Asset reports</h1>
          <p className="text-xs text-muted-foreground">Register, cost and warranty distribution</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportRegister}>
          <Download className="size-3.5" /> Export register
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Tile label="Total assets" value={String(summary?.total ?? 0)} />
        <Tile label="Total cost" value={`₹${(summary?.totalCost ?? 0).toLocaleString("en-IN")}`} />
        <Tile label="Under maintenance" value={String(summary?.maintenance ?? 0)} tone="text-warning" />
        <Tile label="Warranty <60d" value={String(summary?.warrantyExpiringSoon.length ?? 0)} tone="text-warning" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Cost by category</h2>
        <div className="flex flex-col gap-sm">
          {categoryRows.length === 0 ? (
            <p className="py-md text-center text-sm text-muted-foreground">No assets yet.</p>
          ) : (
            categoryRows.map(([name, v]) => (
              <div key={name} className="flex flex-col gap-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-foreground">{name} <Badge tone="neutral">{v.count}</Badge></span>
                  <span className="text-muted-foreground">₹{v.cost.toLocaleString("en-IN")}</span>
                </div>
                <MiniBar percent={(v.cost / maxCost) * 100} toneClassName="bg-primary" />
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

function Tile({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
