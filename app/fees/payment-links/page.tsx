"use client";

// Phase 9F: honestly deferred. No payment-gateway integration exists in this
// repo — a locally generated URL that does not actually process money is not
// a real payment link (see the Fees domain scoping notes). This page states
// that plainly instead of fabricating shareable links.
import { Link2 } from "lucide-react";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function PaymentLinksPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
      <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
        <Link2 className="size-5" />
      </span>
      <p className="text-sm font-medium text-foreground">Online payments aren&apos;t set up yet</p>
      <p className="max-w-sm text-xs text-muted-foreground">This school hasn&apos;t connected an online payment provider. Fees can still be collected and recorded from the Collect Fee page.</p>
    </div>
  );
}
