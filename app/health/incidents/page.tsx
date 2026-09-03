"use client";

// Health Incidents (Phase C2) — DEFERRED. No dedicated Incident model exists
// (no category/severity/location field anywhere in the real schema), and
// HealthVisit already covers everything real that exists here (reason, care
// action, guardian-contacted, follow-up, status) — reusing it under a
// different name would just duplicate /health/visits, not add a real
// capability. This page shows an honest "not configured" state — no
// useSisStore business data, no fabricated incident records.
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function HealthIncidentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view health incidents" role={roleLabels[role]} backHref="/health" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Health incidents</h1>
        <p className="text-xs text-muted-foreground">Not configured</p>
      </div>
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <ShieldAlert className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">A dedicated Incidents record does not exist yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          There is no category, severity, or location field modeled for infirmary events — every real health event is already
          recorded as an Infirmary Visit. This page will connect to a real Incidents domain once that categorization is decided.
        </p>
        <Button asChild size="sm" variant="outline"><Link href="/health/visits">Go to Infirmary visits</Link></Button>
      </div>
    </div>
  );
}
