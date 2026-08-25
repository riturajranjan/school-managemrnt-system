"use client";

// Phase 9F: the mock "Finance Command Centre" mixed fees with wider
// accounting concepts (income/expense pulse) that are out of this phase's
// scope (Accounting is a later phase). Redirect to the real Fee Reports page
// rather than fake a cross-domain finance dashboard.
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function FeeDashboardRedirectPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  useEffect(() => {
    router.replace("/fees/reports");
  }, [router]);
  if (!capabilitiesLoading && !hasServerPermission("fees.view")) return <PermissionDenied action="view the fees module" role={roleLabels[role]} backHref="/fees" />;
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Fee Reports…</div>;
}
