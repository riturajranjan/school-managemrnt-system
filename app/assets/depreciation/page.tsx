"use client";

// Real PostgreSQL/API cutover (Production migration, Phase A) — reads GET
// /api/assets. Book value/accumulated depreciation are derived live server-
// side (lib/server/assets/depreciation.ts) from each asset's real
// cost/purchaseDate/method/rate/salvage — never stored, never posted to
// Accounting. No "Run depreciation" step: there is nothing to run, values
// are always current. Set method/rate/salvage from an asset's edit form.
import Link from "next/link";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAssets } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { AssetDepreciationMethodDto } from "@/lib/api/contracts";

const methodLabels: Record<AssetDepreciationMethodDto, string> = {
  none: "No depreciation", straight_line: "Straight line", declining_balance: "Declining balance",
};

export default function AssetDepreciationPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: assets, loading, error } = useAssets();
  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view depreciation" role={roleLabels[role]} backHref="/assets" />;

  const tracked = assets.filter((a) => a.status !== "retired" && a.depreciationMethod !== "none");
  const totalCost = tracked.reduce((s, a) => s + (a.cost ?? 0), 0);
  const totalBook = tracked.reduce((s, a) => s + (a.bookValue ?? 0), 0);
  const totalAccumulated = tracked.reduce((s, a) => s + a.accumulatedDepreciation, 0);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Depreciation</h1>
        <p className="text-xs text-muted-foreground">Book value is calculated live from each asset&apos;s cost, method and rate — never a stored or posted figure.</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <Tile label="Total cost" value={`₹${totalCost.toLocaleString("en-IN")}`} />
        <Tile label="Book value" value={`₹${totalBook.toLocaleString("en-IN")}`} />
        <Tile label="Accumulated" value={`₹${totalAccumulated.toLocaleString("en-IN")}`} />
      </div>

      {!loading && tracked.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <p className="text-sm text-muted-foreground">No assets have a depreciation method set yet.</p>
          <p className="text-xs text-muted-foreground">Set a method, rate and salvage value from an asset&apos;s detail page to track its book value here.</p>
          <Link href="/assets/register" className="text-sm text-primary hover:underline">Go to the asset register</Link>
        </div>
      ) : (
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
              {tracked.map((a) => (
                <tr key={a.id} className="border-b border-border last:border-0">
                  <td className="p-sm"><Link href={`/assets/${a.id}`} className="font-medium text-foreground hover:underline">{a.name}</Link></td>
                  <td className="p-sm text-muted-foreground">{methodLabels[a.depreciationMethod]} · {a.depreciationRatePercent}%/yr</td>
                  <td className="p-sm text-right text-foreground">₹{(a.cost ?? 0).toLocaleString("en-IN")}</td>
                  <td className="p-sm text-right text-muted-foreground">₹{a.accumulatedDepreciation.toLocaleString("en-IN")}</td>
                  <td className="p-sm text-right font-medium text-foreground">₹{(a.bookValue ?? 0).toLocaleString("en-IN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
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
