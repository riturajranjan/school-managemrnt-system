"use client";

// Hostel Mess (Phase C1) — DEFERRED. No canonical Hostel Mess schema exists,
// and building one now would duplicate the real Cafeteria domain
// (Location/Item/Menu/MealRecord, Phase 9T). This page shows an honest
// "not configured" state — no useSisStore business data, no fabricated menu.
import Link from "next/link";
import { UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function HostelMessPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view the hostel mess" role={roleLabels[role]} backHref="/hostel" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Hostel mess</h1>
        <p className="text-xs text-muted-foreground">Not configured</p>
      </div>
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <UtensilsCrossed className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Hostel mess is not configured for this school</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          There is no dedicated hostel mess domain yet — meal service already has a real home in Cafeteria Management, and a
          separate hostel mess model would duplicate it. This section will connect to that domain once that integration is decided.
        </p>
        <Button asChild size="sm" variant="outline"><Link href="/cafeteria/menu">Go to Cafeteria menu</Link></Button>
      </div>
    </div>
  );
}
