"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, LayoutGrid, Pencil, Printer, Sparkles, UploadCloud } from "lucide-react";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConflictDrawer } from "@/components/academics/timetable/conflict-drawer";
import { ConflictSummaryBar } from "@/components/academics/timetable/conflict-summary-bar";
import { MobileDayView } from "@/components/academics/timetable/mobile-day-view";
import { TimetableGrid } from "@/components/academics/timetable/timetable-grid";
import type { TimetableCardDensity } from "@/components/academics/timetable/timetable-card";
import { usePermissions } from "@/components/providers/permissions-provider";
import { subjectById, roomById, teacherById } from "@/lib/data/seed/academics";
import { useManagedClasses, useTeachers } from "@/lib/hooks/use-academics";
import { useSisStore } from "@/lib/hooks/use-store";
import { useTabletDayWindow } from "@/lib/hooks/use-tablet-day-window";
import { useTimetableConflicts, useTimetables } from "@/lib/hooks/use-timetable";
import { applyResolution, dismissConflict, publishTimetable, pruneResolvedDismissals } from "@/lib/services/timetable-service";
import { isSafeToAutoResolve, summarizeConflicts } from "@/lib/selectors/timetable-conflicts";
import { weekDays, type TimetableConflict, type TimetableConflictType } from "@/lib/types/timetable";

type ViewType = "class" | "teacher" | "room";

function mondayOf(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}

function TimetablePageContent() {
  const searchParams = useSearchParams();
  const classes = useManagedClasses();
  const teachers = useTeachers();
  const timetables = useTimetables();
  const conflicts = useTimetableConflicts();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("timetable.manage");
  const dayWindow = useTabletDayWindow();

  const [viewType, setViewType] = useState<ViewType>("class");
  const [sectionId, setSectionId] = useState(searchParams.get("section") ?? classes[6]?.sections[0]?.id ?? "");
  const [teacherId, setTeacherId] = useState(teachers[0]?.id ?? "");
  const [roomId, setRoomId] = useState("");
  const [density, setDensity] = useState<TimetableCardDensity>("comfortable");
  const [showFreeSlots, setShowFreeSlots] = useState(true);
  const [conflictOnly, setConflictOnly] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TimetableConflictType | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<TimetableConflict | null>(null);
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [confirmPublish, setConfirmPublish] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timeout = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(timeout);
  }, [toast]);

  const timetable = useMemo(() => timetables.find((t) => t.sectionId === sectionId), [timetables, sectionId]);

  const teacherTimetable = useMemo(() => {
    if (!teacherId) return null;
    const slots = timetables.flatMap((t) => t.slots.filter((s) => s.teacherId === teacherId));
    return { id: "teacher-view", session: "", branchId: "", classId: "", sectionId: "", effectiveFrom: "", status: "published" as const, updatedAt: "", slots };
  }, [timetables, teacherId]);

  const dismissedIds = new Set(db.dismissedConflicts.map((d) => d.conflictId));
  const activeConflicts = conflicts.filter((c) => !dismissedIds.has(c.id));
  const activeConflictIds = new Set(conflicts.map((c) => c.id));
  const sectionConflicts = timetable ? activeConflicts.filter((c) => c.slotIds.some((id) => timetable.slots.some((s) => s.id === id))) : [];
  const filteredConflicts = typeFilter ? sectionConflicts.filter((c) => c.type === typeFilter) : sectionConflicts;
  const summary = summarizeConflicts(sectionConflicts);
  const autoResolvableCount = sectionConflicts.filter(isSafeToAutoResolve).length;
  const staleDismissedCount = db.dismissedConflicts.filter((d) => !conflicts.some((c) => c.id === d.conflictId)).length;

  const weekStart = mondayOf(referenceDate);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 5);
  const weekLabel = `${weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${weekEnd.toLocaleDateString(undefined, { month: "short", day: "numeric" })}`;
  const isCurrentWeek = mondayOf(new Date()).getTime() === weekStart.getTime();

  function shiftWeek(deltaWeeks: number) {
    setReferenceDate((d) => {
      const next = new Date(d);
      next.setDate(next.getDate() + deltaWeeks * 7);
      return next;
    });
  }

  function handleExport() {
    const active = viewType === "class" ? timetable : viewType === "teacher" ? teacherTimetable : null;
    if (!active) return;
    const rows = active.slots
      .filter((s) => s.subjectId)
      .map((s) => ({
        Day: s.day,
        Period: s.periodIndex,
        Subject: subjectById(s.subjectId)?.name ?? "",
        Teacher: teacherById(s.teacherId)?.name ?? "",
        Room: roomById(s.roomId)?.name ?? "",
      }));
    const csv = Papa.unparse(rows);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `timetable-${viewType === "class" ? sectionId : teacherId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Timetable</h1>
          <p className="text-xs text-muted-foreground">Class, teacher and room schedules</p>
        </div>
        {canManage && sectionId && viewType === "class" && (
          <div className="flex flex-wrap items-center gap-xs">
            {timetable?.status === "draft" && (
              <Button size="sm" variant="outline" onClick={() => setConfirmPublish(true)}>
                <UploadCloud className="size-3.5" />
                Publish
              </Button>
            )}
            <Button asChild size="sm" variant="outline">
              <Link href={`/academics/timetable/create?section=${sectionId}&autogenerate=1`}>
                <Sparkles className="size-3.5" />
                Auto-generate
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href={`/academics/timetable/create?section=${sectionId}`}>
                <Pencil className="size-3.5" />
                Edit
              </Link>
            </Button>
          </div>
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
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-56" aria-label="Class and section">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {classes.map((c) =>
                c.sections.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {c.name} — Section {s.name}
                  </SelectItem>
                )),
              )}
            </SelectContent>
          </Select>
        )}
        {viewType === "teacher" && (
          <Select value={teacherId} onValueChange={setTeacherId}>
            <SelectTrigger className="w-56" aria-label="Teacher">
              <SelectValue placeholder="Select teacher" />
            </SelectTrigger>
            <SelectContent>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {viewType === "room" && (
          <Select value={roomId} onValueChange={setRoomId}>
            <SelectTrigger className="w-56" aria-label="Room">
              <SelectValue placeholder="Select room" />
            </SelectTrigger>
            <SelectContent>
              {[...new Map(timetables.flatMap((t) => t.slots).filter((s) => s.roomId).map((s) => [s.roomId!, s.roomId!])).values()].map((id) => (
                <SelectItem key={id} value={id}>
                  {roomById(id)?.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {timetable && viewType === "class" && <Badge tone={timetable.status === "published" ? "success" : "neutral"}>{timetable.status}</Badge>}

        {(viewType === "class" || viewType === "teacher") && (
          <div className="ml-auto flex flex-wrap items-center gap-xs">
            <div className="hidden items-center gap-1 rounded-md border border-border px-xs py-0.5 md:flex">
              <Button size="icon" variant="ghost" className="size-7" onClick={() => shiftWeek(-1)} aria-label="Previous week">
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="min-w-[7.5rem] text-center text-xs text-muted-foreground">{weekLabel}</span>
              <Button size="icon" variant="ghost" className="size-7" onClick={() => shiftWeek(1)} aria-label="Next week">
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
            <Button size="sm" variant="ghost" disabled={isCurrentWeek} onClick={() => setReferenceDate(new Date())}>
              Today
            </Button>
            {viewType === "class" && sectionConflicts.length > 0 && (
              <Button size="sm" variant={conflictOnly ? "primary" : "outline"} onClick={() => setConflictOnly((v) => !v)}>
                <Filter className="size-3.5" />
                Conflicts only
              </Button>
            )}
            <Button size="sm" variant="outline" onClick={() => setShowFreeSlots((v) => !v)} className="hidden md:inline-flex">
              {showFreeSlots ? "Hide free" : "Show free"}
            </Button>
            <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))}>
              <LayoutGrid className="size-3.5" />
              {density === "comfortable" ? "Compact" : "Comfortable"}
            </Button>
            <Button size="sm" variant="outline" onClick={handleExport}>
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

      <p className="text-[11px] text-muted-foreground md:block hidden">Recurring weekly timetable — dates are shown for reference; the schedule repeats identically every week.</p>

      {viewType === "class" && timetable && (
        <ConflictSummaryBar
          conflicts={filteredConflicts}
          summary={summary}
          autoResolvableCount={autoResolvableCount}
          dismissedStaleCount={staleDismissedCount}
          activeTypeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          selectedConflictId={selectedConflict?.id ?? null}
          onSelectConflict={setSelectedConflict}
          onAutoResolve={() => {}}
          onDismissResolved={() => pruneResolvedDismissals(activeConflictIds)}
          canManage={false}
        />
      )}

      {viewType === "class" && timetable && (
        <>
          <div className="md:hidden">
            <MobileDayView timetable={timetable} conflicts={sectionConflicts} referenceDate={referenceDate} />
          </div>
          <div className="hidden md:block">
            {dayWindow.isTablet && (
              <div className="mb-xs flex items-center justify-between lg:hidden">
                <Button size="sm" variant="ghost" onClick={dayWindow.goPrevious} disabled={!dayWindow.canGoPrevious} aria-label="Show previous days">
                  <ChevronLeft className="size-4" />
                </Button>
                <span className="text-xs font-medium text-muted-foreground">
                  {dayWindow.visibleDays[0]} – {dayWindow.visibleDays[dayWindow.visibleDays.length - 1]}
                </span>
                <Button size="sm" variant="ghost" onClick={dayWindow.goNext} disabled={!dayWindow.canGoNext} aria-label="Show next days">
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}
            <TimetableGrid
              timetable={timetable}
              conflicts={sectionConflicts}
              selectedConflict={selectedConflict}
              density={density}
              showFreeSlots={showFreeSlots}
              conflictOnly={conflictOnly}
              referenceDate={referenceDate}
              visibleDays={dayWindow.visibleDays}
            />
          </div>
        </>
      )}

      {viewType === "class" && !timetable && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          {sectionId ? "Setting up this section's timetable…" : "Select a class and section to view its timetable."}
        </p>
      )}

      {viewType === "class" && timetable && timetable.slots.every((s) => !s.subjectId) && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          This timetable is empty. {canManage ? "Use Auto-generate or Edit to start scheduling periods." : "No periods have been scheduled yet."}
        </p>
      )}

      {viewType === "teacher" && teacherTimetable && (
        <>
          <div className="md:hidden">
            <MobileDayView timetable={teacherTimetable} referenceDate={referenceDate} />
          </div>
          <div className="hidden md:block">
            <TimetableGrid timetable={teacherTimetable} density={density} showFreeSlots={showFreeSlots} referenceDate={referenceDate} visibleDays={dayWindow.visibleDays} />
          </div>
          {teacherTimetable.slots.every((s) => !s.subjectId) && (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">This teacher has no periods scheduled.</p>
          )}
        </>
      )}

      {viewType === "teacher" && !teacherTimetable && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a teacher to view their schedule.</p>
      )}

      {viewType === "room" && roomId && (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[600px] text-xs">
            <thead>
              <tr className="border-b border-border bg-surface-secondary/60 text-left text-muted-foreground">
                <th className="p-1.5">Day</th>
                <th className="p-1.5">Period</th>
                <th className="p-1.5">Subject</th>
                <th className="p-1.5">Class</th>
              </tr>
            </thead>
            <tbody>
              {weekDays.flatMap((day) =>
                timetables
                  .flatMap((t) => t.slots.filter((s) => s.roomId === roomId && s.day === day).map((s) => ({ slot: s, t })))
                  .map(({ slot, t }) => (
                    <tr key={`${t.id}-${slot.id}`} className="border-b border-border last:border-0">
                      <td className="p-1.5 text-foreground">{day}</td>
                      <td className="p-1.5 text-foreground">P{slot.periodIndex}</td>
                      <td className="p-1.5 text-foreground">{subjectById(slot.subjectId)?.name}</td>
                      <td className="p-1.5 text-muted-foreground">{t.sectionId}</td>
                    </tr>
                  )),
              )}
            </tbody>
          </table>
        </div>
      )}

      {viewType === "room" && !roomId && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a room to see its weekly bookings.</p>
      )}

      <ConflictDrawer
        conflict={selectedConflict}
        db={db}
        canManage={canManage}
        onOpenChange={(open) => !open && setSelectedConflict(null)}
        onApply={(resolution) => {
          if (resolution.kind !== "none") applyResolution(resolution);
          setSelectedConflict(null);
          setToast("Conflict resolved.");
        }}
        onDismiss={(conflictId, reason) => {
          dismissConflict(conflictId, reason, "Academic Coordinator");
          setSelectedConflict(null);
        }}
      />

      <ConfirmDialog
        open={confirmPublish}
        onOpenChange={setConfirmPublish}
        title="Publish this timetable?"
        description="Publishing makes this schedule live for teachers and students immediately."
        confirmLabel="Publish"
        onConfirm={() => {
          if (timetable) {
            publishTimetable(timetable.id);
            setToast("Timetable published — now live for teachers and students.");
          }
          setConfirmPublish(false);
        }}
      />

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-sm rounded-pill border border-success/30 bg-success/12 px-md py-sm text-xs font-medium text-success shadow-floating sm:bottom-6"
        >
          <UploadCloud className="size-3.5" aria-hidden="true" />
          {toast}
        </div>
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
