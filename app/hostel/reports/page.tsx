"use client";

// Hostel Reports (Production migration, Phase C1) — pure aggregator over real
// persisted state. No HostelReport model, no fabricated historical trend
// charts; every metric is a live DB aggregate scoped to tenant/school/branch.
import { StatTile } from "@/components/ui/stat-tile";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHostelReports } from "@/lib/hooks/api/use-hostel-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function HostelReportsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data, loading, error, reload } = useHostelReports();

  if (!capabilitiesLoading && !hasServerPermission("hostel.view") && !hasServerPermission("hostel.manage")) {
    return <PermissionDenied action="view hostel reports" role={roleLabels[role]} backHref="/hostel" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Hostel reports</h1>
        <p className="text-xs text-muted-foreground">Live aggregate operations reporting — no historical trend charts</p>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load hostel reports: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      {loading && !data ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading reports…</p>
      ) : data ? (
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-5">
          <StatTile label="Total hostels" value={String(data.totalHostels)} tone="neutral" />
          <StatTile label="Total rooms" value={String(data.totalRooms)} tone="neutral" />
          <StatTile label="Total beds" value={String(data.totalBeds)} tone="neutral" />
          <StatTile label="Occupied beds" value={String(data.occupiedBeds)} tone="info" />
          <StatTile label="Available beds" value={String(data.availableBeds)} tone="success" />
          <StatTile label="Active residents" value={String(data.activeResidents)} tone="info" />
          <StatTile label="Pending leave requests" value={String(data.pendingLeaveRequests)} tone="warning" />
          <StatTile label="Active visitors" value={String(data.activeVisitors)} tone="info" />
          <StatTile label="Open complaints" value={String(data.openComplaints)} tone="warning" />
          <StatTile label="Pending maintenance" value={String(data.pendingMaintenance)} tone="warning" />
        </div>
      ) : null}
    </div>
  );
}
