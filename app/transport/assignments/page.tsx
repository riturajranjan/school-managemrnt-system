"use client";

// Transport assignments hub (Phase 9M) — real PostgreSQL/API cutover.
import Link from "next/link";
import { UserCog, UsersRound } from "lucide-react";
import { StatTile } from "@/components/ui/stat-tile";
import { useStaffTransportAssignments, useStudentTransportAssignments } from "@/lib/hooks/api/use-transport-api";

export default function TransportAssignmentsHubPage() {
  const { data: studentAssignments } = useStudentTransportAssignments({ status: "active" });
  const { data: staffAssignments } = useStaffTransportAssignments({ status: "active" });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Transport assignments</h1>
        <p className="text-xs text-muted-foreground">Assign students and staff to routes and stops</p>
      </div>

      <div className="grid grid-cols-2 gap-sm">
        <StatTile label="Students on transport" value={String(studentAssignments.length)} icon={UsersRound} tone="neutral" />
        <StatTile label="Staff on transport" value={String(staffAssignments.length)} icon={UserCog} tone="neutral" />
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        <Link href="/transport/student-assignments" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UsersRound className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Student assignments</p>
            <p className="truncate text-xs text-muted-foreground">Assign, bulk-assign and manage student transport</p>
          </div>
        </Link>
        <Link href="/transport/staff-assignments" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <UserCog className="size-4" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">Staff assignments</p>
            <p className="truncate text-xs text-muted-foreground">Assign teachers and staff to routes</p>
          </div>
        </Link>
      </div>
    </div>
  );
}
