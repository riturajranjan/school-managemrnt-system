"use client";

// Teachers directory (Phase 9J) — real PostgreSQL/API cutover. A VIEW over
// real Staff where isTeaching = true (GET /api/staff?teaching=true) — never a
// separate teacher record. Subjects/classes/weekly-periods come from real
// TeachingAssignment + TimetableEntry (GET /api/staff/load-summary), never
// fabricated. hr.view — same gate as the Staff directory itself.
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { fetchTeachingLoadSummary, useStaffList } from "@/lib/hooks/api/use-staff-api";
import type { StaffListItemDto, StaffStatus, TeachingLoadSummaryDto } from "@/lib/api/contracts";
import { initialsOf } from "@/lib/utils";
import { Presentation, UserCheck, UserX } from "lucide-react";

const statusTone: Record<StaffStatus, "success" | "neutral" | "warning"> = { active: "success", inactive: "warning", archived: "neutral" };

export default function TeachersPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: teachers, loading, error } = useStaffList({ teaching: true, pageSize: 200 });
  const [load, setLoad] = useState<Map<string, TeachingLoadSummaryDto>>(new Map());

  useEffect(() => {
    if (teachers.length === 0) return;
    let active = true;
    fetchTeachingLoadSummary(teachers.map((t) => t.id)).then((m) => active && setLoad(m));
    return () => {
      active = false;
    };
  }, [teachers]);

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) {
    return <PermissionDenied action="view the teachers directory" role={roleLabels[role]} backHref="/" />;
  }

  const columns: ColumnDef<StaffListItemDto>[] = [
    {
      id: "name",
      header: "Teacher",
      alwaysVisible: true,
      sortValue: (t) => t.name,
      cell: (t) => (
        <div className="flex items-center gap-sm">
          <Avatar className="size-8">
            <AvatarFallback>{initialsOf(t.name.split(" ")[0], t.name.split(" ")[1] ?? "")}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium text-foreground">{t.name}</p>
            <p className="text-xs text-muted-foreground">{t.employeeCode}</p>
          </div>
        </div>
      ),
    },
    { id: "department", header: "Department", cell: (t) => <span className="text-sm text-foreground">{t.department ?? "—"}</span> },
    {
      id: "subjects",
      header: "Subjects",
      cell: (t) => <span className="text-sm text-foreground">{load.get(t.id)?.subjects.map((s) => s.shortName).join(", ") || "—"}</span>,
    },
    { id: "classes", header: "Sections", cell: (t) => <span className="text-sm text-foreground">{load.get(t.id)?.sectionCount ?? 0}</span> },
    { id: "load", header: "Weekly periods", cell: (t) => <span className="text-sm text-foreground">{load.get(t.id)?.weeklyPeriods ?? 0}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (t) => <Badge tone={statusTone[t.status]}>{t.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Teachers</h1>
        <p className="text-xs text-muted-foreground">Faculty directory</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Total teachers" value={String(teachers.length)} icon={Presentation} tone="info" />
        <StatTile label="Active" value={String(teachers.filter((t) => t.status === "active").length)} icon={UserCheck} tone="success" />
        <StatTile label="Inactive" value={String(teachers.filter((t) => t.status !== "active").length)} icon={UserX} tone="warning" />
      </section>

      {error ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
      ) : loading && teachers.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <DataTable
          columns={columns}
          rows={teachers}
          getRowId={(t) => t.id}
          caption="Teachers"
          onRowClick={(t) => router.push(`/teachers/${t.id}`)}
          renderMobileCard={(t) => (
            <button
              type="button"
              onClick={() => router.push(`/teachers/${t.id}`)}
              className="surface-3d flex w-full items-center gap-sm rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
            >
              <Avatar className="size-10">
                <AvatarFallback>{initialsOf(t.name.split(" ")[0], t.name.split(" ")[1] ?? "")}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-xs">
                  <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
                  <Badge tone={statusTone[t.status]}>{t.status}</Badge>
                </div>
                <p className="truncate text-xs text-muted-foreground">{t.department ?? "—"}</p>
              </div>
            </button>
          )}
          emptyTitle="No teachers yet"
        />
      )}
    </div>
  );
}
