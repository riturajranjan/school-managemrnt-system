"use client";

// Health Appointments (Phase C2) — DEFERRED. HealthVisit is a walk-in/
// check-in log (checkedInAt defaults to now()) — there is no future-dated
// scheduling field, no distinct "reason for scheduling" concept, nothing
// resembling an appointment anywhere in the real schema. This page shows an
// honest "not configured" state — no useSisStore business data, no
// fabricated appointment records.
import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function HealthAppointmentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view health appointments" role={roleLabels[role]} backHref="/health" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Health appointments</h1>
        <p className="text-xs text-muted-foreground">Not configured</p>
      </div>
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <CalendarClock className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Infirmary appointment scheduling is not available yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          Infirmary visits are recorded as they happen (a check-in log), not scheduled in advance — there is no real
          appointment/scheduling model behind this page yet, so nothing is shown here rather than a page that looks booked but isn&apos;t.
        </p>
        <Button asChild size="sm" variant="outline"><Link href="/health/visits">Go to Infirmary visits</Link></Button>
      </div>
    </div>
  );
}
