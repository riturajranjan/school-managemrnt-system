"use client";

import Link from "next/link";
import { useState } from "react";
import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { currentBookValue } from "@/lib/selectors/asset-depreciation";
import { runDepreciation } from "@/lib/services/asset-service";
import { roleLabels } from "@/lib/permissions/roles";
import { depreciationMethodLabels } from "@/lib/types/assets";
import { addMoney, formatMoney, subtractMoney, zeroMoney } from "@/lib/finance/money";

export default function AssetDepreciationPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Accountant", role: roleLabels[role] };
  const [, force] = useState(0);
  if (!can("assets.view")) return <PermissionDenied action="view depreciation" role={roleLabels[role]} backHref="/assets" />;
  const canRun = can("assets.runDepreciation");

  const live = db.assets.filter((a) => a.status !== "disposed");
  const totalCost = live.reduce((s, a) => addMoney(s, a.cost), zeroMoney("INR"));
  const totalBook = live.reduce((s, a) => addMoney(s, currentBookValue(a)), zeroMoney("INR"));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Depreciation</h1>
          <p className="text-xs text-muted-foreground">Decimal-safe book value across the register</p>
        </div>
        {canRun && (
          <Button size="sm" onClick={() => { live.forEach((a) => runDepreciation(a.id, actor)); force((n) => n + 1); }}>
            <Play className="size-3.5" /> Run all
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <Tile label="Total cost" value={formatMoney(totalCost, { compact: true })} />
        <Tile label="Book value" value={formatMoney(totalBook, { compact: true })} />
        <Tile label="Accumulated" value={formatMoney(subtractMoney(totalCost, totalBook), { compact: true })} />
      </div>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-sm font-semibold">Asset</th>
              <th className="p-sm font-semibold">Method</th>
              <th className="p-sm text-right font-semibold">Cost</th>
              <th className="p-sm text-right font-semibold">Accumulated</th>
              <th className="p-sm text-right font-semibold">Book value</th>
            </tr>
          </thead>
          <tbody>
            {live.map((a) => {
              const book = currentBookValue(a);
              return (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-sm"><Link href={`/assets/${a.id}`} className="font-medium text-foreground hover:underline">{a.name}</Link></td>
                  <td className="p-sm"><Badge tone="neutral">{depreciationMethodLabels[a.depreciationMethod]}</Badge></td>
                  <td className="p-sm text-right text-foreground">{formatMoney(a.cost)}</td>
                  <td className="p-sm text-right text-muted-foreground">{formatMoney(subtractMoney(a.cost, book))}</td>
                  <td className="p-sm text-right font-medium text-foreground">{formatMoney(book)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-bold text-foreground">{value}</p>
    </div>
  );
}
