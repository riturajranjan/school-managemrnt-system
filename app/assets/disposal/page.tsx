"use client";

// Real PostgreSQL/API cutover (Production migration, Phase A) — reads GET
// /api/assets/disposals. A disposal is a real terminal audit record: start
// one from an asset's detail page, never from here.
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAssetDisposals } from "@/lib/hooks/api/use-assets-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { AssetDisposalReasonDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const disposalReasonLabels: Record<AssetDisposalReasonDto, string> = {
  end_of_life: "End of life", damaged: "Damaged beyond repair", sold: "Sold", donated: "Donated",
  lost: "Lost", stolen: "Stolen", replaced: "Replaced", other: "Other",
};

export default function AssetDisposalPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: disposals, loading, error } = useAssetDisposals();
  if (!capabilitiesLoading && !hasServerPermission("assets.view")) return <PermissionDenied action="view disposals" role={roleLabels[role]} backHref="/assets" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset disposal</h1>
        <p className="text-xs text-muted-foreground">Controlled retirement — history is preserved, never hard-deleted. Start a disposal from an asset&apos;s detail page.</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      {!loading && disposals.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Trash2 className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No disposals recorded.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {disposals.map((d) => (
            <Link key={d.id} href={`/assets/${d.assetId}`} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{d.assetName}</p>
                <p className="text-xs text-muted-foreground">
                  {disposalReasonLabels[d.reason]} · {formatDate(d.disposedAt)}
                  {d.value !== null ? ` · ₹${d.value.toLocaleString("en-IN")}` : ""}
                  {d.recipient ? ` · ${d.recipient}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-muted-foreground">{d.assetTag}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
