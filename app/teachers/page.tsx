"use client";

import { useRouter } from "next/navigation";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { useSisStore } from "@/lib/hooks/use-store";
import type { Teacher } from "@/lib/types/academics";
import { initialsOf } from "@/lib/utils";
import { Presentation, UserCheck, Users } from "lucide-react";

export default function TeachersPage() {
  const db = useSisStore();
  const router = useRouter();

  const columns: ColumnDef<Teacher>[] = [
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
            <p className="text-xs text-muted-foreground">{t.employeeId}</p>
          </div>
        </div>
      ),
    },
    { id: "department", header: "Department", cell: (t) => <span className="text-sm text-foreground">{t.department}</span> },
    {
      id: "subjects",
      header: "Subjects",
      cell: (t) => <span className="text-sm text-foreground">{db.subjects.filter((s) => t.subjectIds.includes(s.id)).map((s) => s.shortName).join(", ") || "—"}</span>,
    },
    {
      id: "classes",
      header: "Classes",
      cell: (t) => <span className="text-sm text-foreground">{new Set(db.subjectAssignments.filter((a) => a.primaryTeacherId === t.id).map((a) => a.sectionId)).size}</span>,
    },
    { id: "load", header: "Weekly periods", cell: (t) => <span className="text-sm text-foreground">{db.subjectAssignments.filter((a) => a.primaryTeacherId === t.id).reduce((sum, a) => sum + a.weeklyPeriods, 0)}/{t.maxWeeklyPeriods}</span>, defaultVisible: false },
    { id: "status", header: "Status", align: "right", cell: (t) => <Badge tone={t.status === "active" ? "success" : t.status === "on-leave" ? "warning" : "neutral"}>{t.status.replace("-", " ")}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Teachers</h1>
        <p className="text-xs text-muted-foreground">Faculty directory</p>
      </div>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-3">
        <StatTile label="Total teachers" value={String(db.teachers.length)} icon={Presentation} tone="info" />
        <StatTile label="Active today" value={String(db.teachers.filter((t) => t.status === "active").length)} icon={UserCheck} tone="success" />
        <StatTile label="On leave" value={String(db.teachers.filter((t) => t.status === "on-leave").length)} icon={Users} tone="warning" />
      </section>

      <DataTable
        columns={columns}
        rows={db.teachers}
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
                <Badge tone={t.status === "active" ? "success" : "warning"}>{t.status.replace("-", " ")}</Badge>
              </div>
              <p className="truncate text-xs text-muted-foreground">{t.department}</p>
            </div>
          </button>
        )}
        emptyTitle="No teachers yet"
      />
    </div>
  );
}
