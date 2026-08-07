"use client";

import { useState } from "react";
import { Building2, Clock, Save, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportShiftPolicies } from "@/lib/hooks/use-transport";
import { updateShiftPolicy } from "@/lib/services/transport-settings-service";
import { transportShiftLabels, type TransportShift } from "@/lib/types/transport";
import { GPS_STALE_THRESHOLD_MINUTES } from "@/lib/types/gps";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { BRANCH } from "@/lib/data/seed/transport";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

export default function TransportSettingsPage() {
  const policies = useTransportShiftPolicies();
  const { can } = usePermissions();
  const canManage = can("transport.manageSettings");

  const [draft, setDraft] = useState<Record<TransportShift, { defaultPickupTime: string; defaultDropTime: string }>>(() =>
    Object.fromEntries(policies.map((p) => [p.shift, { defaultPickupTime: p.defaultPickupTime, defaultDropTime: p.defaultDropTime }])) as Record<TransportShift, { defaultPickupTime: string; defaultDropTime: string }>,
  );
  const [savedShift, setSavedShift] = useState<TransportShift | null>(null);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transport settings</h1>
        <p className="text-xs text-muted-foreground">Shifts, branch and safety policy configuration</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Clock className="size-4" /> Shift default times
        </h2>
        <p className="mb-sm text-xs text-muted-foreground">Prefilled when a new stop is added to a route on this shift — doesn&apos;t change existing routes.</p>
        <div className="flex flex-col gap-sm">
          {policies.map((policy) => (
            <div key={policy.shift} className="grid grid-cols-1 items-end gap-xs sm:grid-cols-[100px_1fr_1fr_auto]">
              <span className="text-sm font-medium text-foreground">{transportShiftLabels[policy.shift]}</span>
              <div>
                <Label htmlFor={`pickup-${policy.shift}`}>Default pickup</Label>
                <Input
                  id={`pickup-${policy.shift}`}
                  type="time"
                  disabled={!canManage}
                  value={draft[policy.shift]?.defaultPickupTime ?? policy.defaultPickupTime}
                  onChange={(e) => setDraft((current) => ({ ...current, [policy.shift]: { ...current[policy.shift], defaultPickupTime: e.target.value } }))}
                />
              </div>
              <div>
                <Label htmlFor={`drop-${policy.shift}`}>Default drop</Label>
                <Input
                  id={`drop-${policy.shift}`}
                  type="time"
                  disabled={!canManage}
                  value={draft[policy.shift]?.defaultDropTime ?? policy.defaultDropTime}
                  onChange={(e) => setDraft((current) => ({ ...current, [policy.shift]: { ...current[policy.shift], defaultDropTime: e.target.value } }))}
                />
              </div>
              {canManage && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const values = draft[policy.shift];
                    if (!values) return;
                    updateShiftPolicy(policy.shift, values, ACTOR);
                    setSavedShift(policy.shift);
                    window.setTimeout(() => setSavedShift((current) => (current === policy.shift ? null : current)), 2000);
                  }}
                >
                  <Save className="size-3.5" />
                  {savedShift === policy.shift ? "Saved" : "Save"}
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Building2 className="size-4" /> Branch
        </h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">Branch</dt>
          <dd className="text-foreground">{BRANCH}</dd>
          <dt className="text-muted-foreground">Session</dt>
          <dd className="text-foreground">{CURRENT_SESSION}</dd>
        </dl>
        <p className="mt-sm text-xs text-muted-foreground">This deployment is configured for a single branch — multi-branch transport management uses the same route/vehicle/driver model, scoped by branch.</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <ShieldCheck className="size-4" /> Safety policy
        </h2>
        <dl className="grid grid-cols-2 gap-y-2 text-sm">
          <dt className="text-muted-foreground">GPS staleness threshold</dt>
          <dd className="text-foreground">{GPS_STALE_THRESHOLD_MINUTES} minute(s)</dd>
        </dl>
        <p className="mt-sm text-xs text-muted-foreground">A vehicle&apos;s last GPS ping older than this is never shown as live — see /transport/live and /transport/vehicles/[id].</p>
      </div>
    </div>
  );
}
