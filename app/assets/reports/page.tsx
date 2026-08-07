"use client";

import { Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MiniBar } from "@/components/dashboard/mini-charts";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { assetSummary } from "@/lib/selectors/asset-brief";
import { currentBookValue } from "@/lib/selectors/asset-depreciation";
import { roleLabels } from "@/lib/permissions/roles";
import { addMoney, formatMoney, zeroMoney } from "@/lib/finance/money";
import { assetStatusLabels } from "@/lib/types/assets";
import { downloadTextFile } from "@/lib/utils";

export default function AssetReportsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("assets.viewReports")) return <PermissionDenied action="view asset reports" role={roleLabels[role]} backHref="/assets" />;

  const summary = assetSummary(db);
  const byDept = new Map<string, { count: number; value: ReturnType<typeof zeroMoney> }>();
  for (const a of db.assets.filter((x) => x.status !== "disposed")) {
    const key = a.department ?? "Unassigned";
    const entry = byDept.get(key) ?? { count: 0, value: zeroMoney("INR") };
    entry.count += 1;
    entry.value = addMoney(entry.value, currentBookValue(a));
    byDept.set(key, entry);
  }
  const deptRows = [...byDept.entries()].sort((a, b) => b[1].value.minorUnits - a[1].value.minorUnits);
  const maxVal = Math.max(1, ...deptRows.map(([, v]) => v.value.minorUnits));

  function exportRegister() {
    const lines = ["Asset,Tag,Category,Status,Cost,Book value,Location"];
    for (const a of db.assets) {
      const cat = db.assetCategories.find((c) => c.id === a.categoryId)?.name ?? "";
      lines.push([a.name, a.assetTag, cat, assetStatusLabels[a.status], formatMoney(a.cost), formatMoney(currentBookValue(a)), a.assignedToName ?? a.location].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
    }
    downloadTextFile("asset-register.csv", lines.join("\n"));
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Asset reports</h1>
          <p className="text-xs text-muted-foreground">Register, depreciation, warranty and department distribution</p>
        </div>
        <Button size="sm" variant="outline" onClick={exportRegister}>
          <Download className="size-3.5" /> Export register
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <Tile label="Total assets" value={String(summary.total)} />
        <Tile label="Book value" value={formatMoney(summary.bookValue, { compact: true })} />
        <Tile label="Maintenance due" value={String(summary.maintenanceDue)} tone="text-warning" />
        <Tile label="Warranty <60d" value={String(summary.warrantyExpiringSoon)} tone="text-warning" />
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Book value by department</h2>
        <div className="flex flex-col gap-sm">
          {deptRows.map(([name, v]) => (
            <div key={name} className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-sm">
                <span className="text-foreground">{name} <Badge tone="neutral">{v.count}</Badge></span>
                <span className="text-muted-foreground">{formatMoney(v.value, { compact: true })}</span>
              </div>
              <MiniBar percent={(v.value.minorUnits / maxVal) * 100} toneClassName="bg-primary" />
            </div>
          ))}
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
