"use client";

import Link from "next/link";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { disposalReasonLabels, disposalStatusLabels, type DisposalStatus } from "@/lib/types/assets";
import { formatMoney } from "@/lib/finance/money";
import { formatDate } from "@/lib/utils";

const tone: Record<DisposalStatus, "success" | "warning" | "info" | "neutral" | "error"> = {
  requested: "warning",
  reviewed: "info",
  approved: "info",
  completed: "success",
  rejected: "error",
};

export default function AssetDisposalPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("assets.view")) return <PermissionDenied action="view disposals" role={roleLabels[role]} backHref="/assets" />;
  const assetName = (id: string) => db.assets.find((a) => a.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Asset disposal</h1>
        <p className="text-xs text-muted-foreground">Controlled retirement — history is preserved, never hard-deleted. Start a disposal from an asset&apos;s detail page.</p>
      </div>

      {db.assetDisposals.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Trash2 className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No disposals recorded.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {db.assetDisposals.map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <Link href={`/assets/${d.assetId}`} className="truncate text-sm font-medium text-foreground hover:underline">{assetName(d.assetId)}</Link>
                <p className="text-xs text-muted-foreground">
                  {disposalReasonLabels[d.reason]} · requested {formatDate(d.requestedAt)}
                  {d.disposalValue ? ` · ${formatMoney(d.disposalValue)}` : ""}
                  {d.recipient ? ` · ${d.recipient}` : ""}
                </p>
              </div>
              <Badge tone={tone[d.status]}>{disposalStatusLabels[d.status]}</Badge>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
