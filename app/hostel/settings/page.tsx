"use client";

// Hostel Settings (Phase C1) — DEFERRED. No canonical school-scoped Hostel
// configuration model exists (no generic JSON settings table was created,
// per the phase's explicit scope). This page shows an honest "not
// configured" state — no fake persisted-looking configuration, no
// useSisStore business data. Hostels/rooms/beds themselves are managed on
// their own real pages (/hostel/buildings, /hostel/rooms, /hostel/beds).
import Link from "next/link";
import { Building2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";

export default function HostelSettingsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view hostel settings" role={roleLabels[role]} backHref="/hostel" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Hostel settings</h1>
        <p className="text-xs text-muted-foreground">Not configured</p>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Building2 className="size-4" /> Buildings, rooms &amp; beds</h2>
        <p className="mb-sm text-sm text-muted-foreground">Hostels, rooms and beds are managed as real records on their own pages, not here.</p>
        <div className="flex flex-wrap gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hostel/buildings">Buildings</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hostel/rooms">Rooms</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hostel/beds">Beds</Link></Button>
        </div>
      </div>

      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <Settings2 className="size-6 text-muted-foreground" />
        <p className="text-sm font-medium text-foreground">Hostel policy configuration is not available yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">
          There is no canonical school-scoped hostel configuration model — leave policies, visiting hours and similar settings
          are not stored anywhere real yet, so nothing is shown here rather than a page that looks saved but is not.
        </p>
      </div>
    </div>
  );
}
