"use client";

// Phase 9F: Concessions had no separate real backing — a concession is a
// DISCOUNT with a reason (see lib/server/fees/adjustments.ts's doc comment
// on the one canonical adjustment engine). Redirect rather than duplicate
// the Discounts page.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function ConcessionsRedirectPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  useEffect(() => {
    router.replace("/fees/discounts");
  }, [router]);
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Discounts…</div>;
}
