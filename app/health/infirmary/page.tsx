"use client";

// Infirmary live board (Phase 9R) — real PostgreSQL/API cutover. Lifecycle is
// deliberately minimal (OPEN -> CLOSED or OPEN -> REFERRED) — no invented
// clinical states like the old mock's waiting/resting/guardian-pickup.
import { useState } from "react";
import { Activity, EyeOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { closeHealthVisitRequest, referHealthVisitRequest, useHealthVisits } from "@/lib/hooks/api/use-health-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { HealthVisitDto } from "@/lib/api/contracts";
import { timeAgo } from "@/lib/utils";

export default function InfirmaryBoardPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [shared, setShared] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [referring, setReferring] = useState<HealthVisitDto | null>(null);
  const [destination, setDestination] = useState("");
  const [notes, setNotes] = useState("");
  const { data: active, reload } = useHealthVisits({ status: "open", pageSize: 100 });

  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view the infirmary board" role={roleLabels[role]} backHref="/health" />;
  const canManage = hasServerPermission("health.manage");

  async function close(id: string) {
    setBusyId(id);
    await closeHealthVisitRequest(id);
    setBusyId(null);
    reload();
  }
  async function submitRefer() {
    if (!referring) return;
    setBusyId(referring.id);
    await referHealthVisitRequest(referring.id, { referralDestination: destination || undefined, referralNotes: notes || undefined });
    setBusyId(null);
    setReferring(null);
    setDestination("");
    setNotes("");
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Infirmary board</h1><p className="text-xs text-muted-foreground">{active.length} active · operational view</p></div>
        <Button size="sm" variant={shared ? "primary" : "outline"} onClick={() => setShared((v) => !v)}><EyeOff className="size-3.5" /> {shared ? "Shared-display mode on" : "Shared-display mode"}</Button>
      </div>
      {shared && <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Shared-display mode hides visit reasons and sensitive detail for public screens.</p>}

      {active.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><Activity className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No students in the infirmary right now.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {active.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{v.patientName} <span className="text-xs text-muted-foreground">· {v.patientRef}</span></p>
                <p className="truncate text-xs text-muted-foreground">
                  Arrived {timeAgo(v.checkedInAt)}{!shared && v.reason ? ` · ${v.reason}` : ""} · {v.attendedByStaffName ?? "Unattended"}
                  {v.guardianContacted ? " · guardian contacted" : ""}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-xs">
                <Badge tone="warning">Open</Badge>
                {canManage && !shared && (
                  <>
                    <Button size="sm" variant="outline" disabled={busyId === v.id} onClick={() => close(v.id)}>Close</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === v.id} onClick={() => setReferring(v)}>Refer</Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={referring !== null} onOpenChange={(o) => !o && setReferring(null)} title="Refer visit" description={referring ? `Refer ${referring.patientName} externally` : "Refer"}>
        <div className="flex flex-col gap-md">
          <div className="flex flex-col gap-1.5"><Label htmlFor="dest">Destination</Label><Input id="dest" value={destination} onChange={(e) => setDestination(e.target.value)} placeholder="e.g. City Hospital" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="rnotes">Notes</Label><Input id="rnotes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Factual referral notes" /></div>
          <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => setReferring(null)}>Cancel</Button><Button onClick={submitRefer} disabled={busyId === referring?.id}>Confirm referral</Button></div>
        </div>
      </DetailDrawer>
    </div>
  );
}
