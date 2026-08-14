"use client";

// Timetable (Phase 7B.2) — real PostgreSQL/API cutover of the legacy view. Class
// and Teacher schedules come from the real Phase-7 endpoints; the grid columns are
// the real bell schedule (/api/timetable/periods) and each cell resolves through
// real Section/Subject/Staff/Period ids. No mock store, no client conflict engine.
// Room view is honestly deferred (no Facilities/Room foundation). Conflicts are
// PREVENTED at save time by the server (see the builder), so there is no post-hoc
// conflict panel here.
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Download, Pencil, Printer } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RealTimetableGrid } from "@/components/academics/timetable/real-timetable-grid";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses, useSections } from "@/lib/hooks/api/use-academics-foundation";
import { useTeachingStaff } from "@/lib/hooks/api/use-staff";
import { useSectionTimetable, useTeacherTimetable } from "@/lib/hooks/api/use-timetable-api";
import type { TimetableEntryDto } from "@/lib/api/contracts";

type ViewType = "class" | "teacher" | "room";

function exportCsv(entries: TimetableEntryDto[], name: string) {
  const rows = entries.map((e) => ({ Day: e.weekday, Subject: e.subject.name, Teacher: e.staff.name, Section: `${e.section.className} ${e.section.name}` }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `timetable-${name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function TimetablePageContent() {
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const canManage = can("timetable.manage");
  const { data: classes } = useClasses();
  const { data: sections } = useSections();
  const { data: teachersData } = useTeachingStaff();
  const teachers = teachersData ?? [];

  const [viewType, setViewType] = useState<ViewType>("class");
  const [sectionId, setSectionId] = useState(searchParams.get("section") ?? "");
  const [staffId, setStaffId] = useState("");

  const effectiveSectionId = sectionId || sections[0]?.id || "";
  const { data: sectionTt, loading: sLoading, error: sError } = useSectionTimetable(viewType === "class" ? effectiveSectionId : undefined);
  const { data: teacherTt, loading: tLoading, error: tError } = useTeacherTimetable(viewType === "teacher" ? staffId : undefined);

  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Timetable</h1>
          <p className="text-xs text-muted-foreground">Class and teacher schedules</p>
        </div>
        {canManage && viewType === "class" && effectiveSectionId && (
          <Button asChild size="sm">
            <Link href={`/academics/timetable/create?section=${effectiveSectionId}`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-sm">
        <div className="flex items-center gap-1 rounded-md bg-surface-secondary p-1">
          {(["class", "teacher", "room"] as ViewType[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setViewType(v)}
              className={`min-h-11 rounded-md px-md text-xs font-medium capitalize transition-colors sm:min-h-8 ${viewType === v ? "bg-surface shadow-card text-foreground" : "text-muted-foreground"}`}
            >
              {v}
            </button>
          ))}
        </div>

        {viewType === "class" && (
          <Select value={effectiveSectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-56" aria-label="Class and section">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {className.get(s.classId) ?? s.className} — Section {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {viewType === "teacher" && (
          <Select value={staffId} onValueChange={setStaffId}>
            <SelectTrigger className="w-56" aria-label="Teacher">
              <SelectValue placeholder="Select teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name} · {t.employeeCode}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {(viewType === "class" || viewType === "teacher") && (
          <div className="ml-auto flex flex-wrap items-center gap-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const tt = viewType === "class" ? sectionTt : teacherTt;
                if (tt) exportCsv(tt.entries, viewType === "class" ? effectiveSectionId : staffId);
              }}
            >
              <Download className="size-3.5" />
              Export
            </Button>
            <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => window.print()}>
              <Printer className="size-3.5" />
              Print
            </Button>
          </div>
        )}
      </div>

      {viewType === "room" && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          Room scheduling will be available when the Facilities / Room foundation is enabled.
        </p>
      )}

      {viewType === "class" && (
        sError ? (
          <p className="rounded-lg border border-error/30 bg-error/10 p-md text-center text-sm text-error">{sError}</p>
        ) : sLoading ? (
          <p className="py-2xl text-center text-sm text-muted-foreground">Loading timetable…</p>
        ) : !effectiveSectionId ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a class and section to view its timetable.</p>
        ) : sectionTt ? (
          <RealTimetableGrid periods={sectionTt.periods} weekdays={sectionTt.weekdays} entries={sectionTt.entries} />
        ) : null
      )}

      {viewType === "teacher" && (
        tError ? (
          <p className="rounded-lg border border-error/30 bg-error/10 p-md text-center text-sm text-error">{tError}</p>
        ) : !staffId ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a teacher to view their schedule.</p>
        ) : tLoading ? (
          <p className="py-2xl text-center text-sm text-muted-foreground">Loading schedule…</p>
        ) : teacherTt ? (
          <RealTimetableGrid periods={teacherTt.periods} weekdays={teacherTt.weekdays} entries={teacherTt.entries} />
        ) : null
      )}
    </div>
  );
}

export default function TimetablePage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <TimetablePageContent />
    </Suspense>
  );
}
