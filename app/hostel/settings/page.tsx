"use client";

import { Building2, Settings2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { buildingStatusTone, hostelTypeLabels } from "@/lib/types/hostel";

export default function HostelSettingsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hostel.view")) return <PermissionDenied action="view hostel settings" role={roleLabels[role]} backHref="/hostel" />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Hostel settings</h1><p className="text-xs text-muted-foreground">Buildings, wardens and configuration</p></div>
      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Building2 className="size-4" /> Buildings & wardens</h2>
        <div className="flex flex-col gap-sm">
          {db.hostelBuildings.map((b) => (
            <div key={b.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <div><p className="text-sm font-medium text-foreground">{b.name} <span className="text-xs text-muted-foreground">({b.code})</span></p><p className="text-xs text-muted-foreground">{hostelTypeLabels[b.type]} · {b.floors} floors · Warden {b.wardenName}</p></div>
              <Badge tone={buildingStatusTone[b.status]}>{b.status}</Badge>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Settings2 className="size-4" /> Configuration</h2>
        <p className="text-sm text-muted-foreground">Room types, facilities, mess plans and leave policies are managed here in a connected build. This module runs on typed frontend state; persistence arrives in a later phase.</p>
      </section>
    </div>
  );
}
