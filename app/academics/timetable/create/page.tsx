"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  LayoutGrid,
  Printer,
  Redo2,
  Sparkles,
  Undo2,
  UploadCloud,
} from "lucide-react";
import Papa from "papaparse";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConflictDrawer } from "@/components/academics/timetable/conflict-drawer";
import { ConflictSummaryBar } from "@/components/academics/timetable/conflict-summary-bar";
import { MobileDayView } from "@/components/academics/timetable/mobile-day-view";
import { SlotEditorDrawer } from "@/components/academics/timetable/slot-editor-drawer";
import { TimetableGrid } from "@/components/academics/timetable/timetable-grid";
import type { TimetableCardDensity } from "@/components/academics/timetable/timetable-card";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roomById, subjectById, teacherById } from "@/lib/data/seed/academics";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSectionTimetable } from "@/lib/hooks/use-timetable";
import { useSisStore } from "@/lib/hooks/use-store";
import { useTabletDayWindow } from "@/lib/hooks/use-tablet-day-window";
import { useTimetableHistory } from "@/lib/hooks/use-timetable-history";
import { detectConflicts, applyResolution as commitResolution, createTimetableIfMissing, dismissConflict, proposeTimetable, publishTimetable, pruneResolvedDismissals, saveProposedTimetable, type ProposedTimetable } from "@/lib/services/timetable-service";
import { isSafeToAutoResolve, summarizeConflicts, suggestResolution, type SuggestedResolution } from "@/lib/selectors/timetable-conflicts";
import { opUpdateSlot, slotsAreEqual } from "@/lib/utils/timetable-slot-ops";
import { weekDays, type Timetable, type TimetableConflict, type TimetableConflictType, type TimetableSlot } from "@/lib/types/timetable";

function TimetableBuilderContent() {
  const searchParams = useSearchParams();
  const classes = useManagedClasses();
  const db = useSisStore();
  const { can } = usePermissions();

  const initialSectionId = searchParams.get("section") ?? classes[6]?.sections[0]?.id ?? "";
  const [sectionId, setSectionId] = useState(initialSectionId);
  const [pendingSectionId, setPendingSectionId] = useState<string | null>(null);
  const schoolClass = classes.find((c) => c.sections.some((s) => s.id === sectionId));
  const storeTimetable = useSectionTimetable(sectionId);

  const [workingSlots, setWorkingSlots] = useState<TimetableSlot[]>(storeTimetable?.slots ?? []);
  const [syncedSlots, setSyncedSlots] = useState(storeTimetable?.slots);
  const [editSlot, setEditSlot] = useState<TimetableSlot | null>(null);
  const [selectedConflict, setSelectedConflict] = useState<TimetableConflict | null>(null);
  const [typeFilter, setTypeFilter] = useState<TimetableConflictType | null>(null);
  const [copyFrom, setCopyFrom] = useState<(typeof weekDays)[number]>("Monday");
  const [copyTo, setCopyTo] = useState<(typeof weekDays)[number]>("Tuesday");
  const [proposal, setProposal] = useState<ProposedTimetable | null>(() =>
    searchParams.get("autogenerate") === "1" && initialSectionId ? proposeTimetable(initialSectionId, 1) : null,
  );
  const [version, setVersion] = useState(1);
  const [density, setDensity] = useState<TimetableCardDensity>("comfortable");
  const [showFreeSlots, setShowFreeSlots] = useState(true);
  const [saveConfirmation, setSaveConfirmation] = useState<"draft" | "published" | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const dayWindow = useTabletDayWindow();

  useEffect(() => {
    if (!saveConfirmation) return;
    const timeout = setTimeout(() => setSaveConfirmation(null), 4000);
    return () => clearTimeout(timeout);
  }, [saveConfirmation]);

  const canManage = can("timetable.manage");

  useEffect(() => {
    if (sectionId && schoolClass && !storeTimetable) {
      createTimetableIfMissing(schoolClass.id, sectionId, CURRENT_SESSION, "main");
    }
  }, [sectionId, schoolClass, storeTimetable]);


  // Resync the local working draft whenever we land on a different (or newly created) store timetable
  // — render-time reset (React's documented pattern) instead of an effect, to avoid a cascading render.
  if (storeTimetable?.slots !== syncedSlots) {
    setSyncedSlots(storeTimetable?.slots);
    setWorkingSlots(storeTimetable?.slots ?? []);
  }

  const isDirty = storeTimetable ? !slotsAreEqual(workingSlots, storeTimetable.slots) : false;
  const history = useTimetableHistory(workingSlots, setWorkingSlots);

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const draftTimetable: Timetable | null = storeTimetable ? { ...storeTimetable, slots: workingSlots } : null;

  const previewDb = useMemo(() => {
    if (!storeTimetable) return db;
    return { ...db, timetables: db.timetables.map((t) => (t.id === storeTimetable.id ? { ...t, slots: workingSlots } : t)) };
  }, [db, storeTimetable, workingSlots]);

  const allConflicts = useMemo(() => detectConflicts(previewDb), [previewDb]);
  const dismissedIds = new Set(db.dismissedConflicts.map((d) => d.conflictId));
  const activeConflicts = allConflicts.filter((c) => !dismissedIds.has(c.id));
  const sectionConflicts = draftTimetable ? activeConflicts.filter((c) => c.slotIds.some((id) => draftTimetable.slots.some((s) => s.id === id))) : [];
  const summary = summarizeConflicts(sectionConflicts);
  const autoResolvableCount = sectionConflicts.filter(isSafeToAutoResolve).length;
  const staleDismissedCount = db.dismissedConflicts.filter((d) => !allConflicts.some((c) => c.id === d.conflictId)).length;
  const activeConflictIds = new Set(allConflicts.map((c) => c.id));

  if (!canManage) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to edit timetables.</p>;
  }

  function applyLocalSlots(next: TimetableSlot[]) {
    history.recordAndRun(next);
  }

  function handleApplyResolution(resolution: SuggestedResolution) {
    if (resolution.kind === "none" || !draftTimetable) return;
    if (resolution.timetableId === draftTimetable.id) {
      const patch = resolution.kind === "move-room" ? { roomId: resolution.roomId } : resolution.kind === "reassign-teacher" ? { teacherId: resolution.teacherId } : null;
      if (patch) applyLocalSlots(opUpdateSlot(workingSlots, resolution.slotId, patch));
      else if (resolution.kind === "move-period") {
        const source = workingSlots.find((s) => s.id === resolution.slotId);
        if (!source) return;
        const next = workingSlots.map((s) => {
          if (s.id === resolution.slotId) return { ...s, subjectId: undefined, teacherId: undefined, roomId: undefined };
          if (s.day === resolution.day && s.periodIndex === resolution.periodIndex) return { ...s, subjectId: source.subjectId, teacherId: source.teacherId, roomId: source.roomId };
          return s;
        });
        applyLocalSlots(next);
      }
    } else {
      // The conflict involves a different section's timetable, which isn't open for local editing here — commit directly.
      commitResolution(resolution);
    }
    setSelectedConflict(null);
    setAnnouncement("Conflict resolved.");
  }

  function handleAutoResolve() {
    let local = workingSlots;
    let count = 0;
    for (const conflict of sectionConflicts) {
      if (!isSafeToAutoResolve(conflict)) continue;
      const iterationDb = draftTimetable ? { ...previewDb, timetables: previewDb.timetables.map((t) => (t.id === draftTimetable.id ? { ...t, slots: local } : t)) } : previewDb;
      const resolution = suggestResolution(iterationDb, conflict, weekDays);
      if (resolution.kind === "move-room" && draftTimetable && resolution.timetableId === draftTimetable.id) {
        local = opUpdateSlot(local, resolution.slotId, { roomId: resolution.roomId });
        count += 1;
      } else if (resolution.kind === "move-room") {
        commitResolution(resolution);
        count += 1;
      }
    }
    if (!slotsAreEqual(local, workingSlots)) history.recordAndRun(local);
    if (count > 0) setAnnouncement(`${count} conflict${count === 1 ? "" : "s"} auto-resolved.`);
  }

  function handleSectionChange(nextId: string) {
    if (isDirty) setPendingSectionId(nextId);
    else setSectionId(nextId);
  }

  function handleSaveDraft() {
    if (!storeTimetable) return;
    saveProposedTimetable(storeTimetable.id, workingSlots);
    history.reset();
    setSaveConfirmation("draft");
  }

  function handlePublish() {
    if (!storeTimetable) return;
    saveProposedTimetable(storeTimetable.id, workingSlots);
    publishTimetable(storeTimetable.id);
    history.reset();
    setSaveConfirmation("published");
  }

  function handleExport() {
    if (!draftTimetable) return;
    const rows = draftTimetable.slots
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
    a.download = `timetable-${sectionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-md pb-28 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Timetable builder</h1>
          <p className="text-xs text-muted-foreground">Click a period to edit it — every action also works from the keyboard</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Select value={sectionId} onValueChange={handleSectionChange}>
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
          {storeTimetable && <Badge tone={storeTimetable.status === "published" ? "success" : "neutral"}>{storeTimetable.status}</Badge>}
          {isDirty && <Badge tone="warning">Unsaved changes</Badge>}
        </div>
      </div>

      {draftTimetable && <ConflictSummaryBar
        conflicts={sectionConflicts}
        summary={summary}
        autoResolvableCount={autoResolvableCount}
        dismissedStaleCount={staleDismissedCount}
        activeTypeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        selectedConflictId={selectedConflict?.id ?? null}
        onSelectConflict={setSelectedConflict}
        onAutoResolve={handleAutoResolve}
        onDismissResolved={() => pruneResolvedDismissals(activeConflictIds)}
        canManage={canManage}
      />}

      <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm">
        <div className="flex flex-wrap items-center gap-xs">
          <span className="text-xs font-medium text-foreground">Duplicate day:</span>
          <Select value={copyFrom} onValueChange={(v) => setCopyFrom(v as (typeof weekDays)[number])}>
            <SelectTrigger className="w-28" aria-label="Copy from day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekDays.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground">to</span>
          <Select value={copyTo} onValueChange={(v) => setCopyTo(v as (typeof weekDays)[number])}>
            <SelectTrigger className="w-28" aria-label="Copy to day">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {weekDays.map((d) => (
                <SelectItem key={d} value={d}>
                  {d}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const source = workingSlots.filter((s) => s.day === copyFrom);
              const next = workingSlots.map((slot) => {
                if (slot.day !== copyTo || slot.locked) return slot;
                const match = source.find((s) => s.periodIndex === slot.periodIndex);
                return match ? { ...slot, subjectId: match.subjectId, teacherId: match.teacherId, roomId: match.roomId, slotType: match.slotType } : slot;
              });
              applyLocalSlots(next);
            }}
          >
            <Copy className="size-3.5" />
            Duplicate
          </Button>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-xs">
          <Button size="sm" variant="ghost" onClick={history.undo} disabled={!history.canUndo} aria-label="Undo last change">
            <Undo2 className="size-3.5" />
          </Button>
          <Button size="sm" variant="ghost" onClick={history.redo} disabled={!history.canRedo} aria-label="Redo change">
            <Redo2 className="size-3.5" />
          </Button>
          <Button size="sm" variant="outline" onClick={() => setDensity((d) => (d === "comfortable" ? "compact" : "comfortable"))}>
            <LayoutGrid className="size-3.5" />
            {density === "comfortable" ? "Compact" : "Comfortable"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleExport}>
            <Download className="size-3.5" />
            Export
          </Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const next = version + 1;
              setVersion(next);
              setProposal(proposeTimetable(sectionId, next));
            }}
          >
            <Sparkles className="size-3.5" />
            Regenerate with AI
          </Button>
        </div>
      </div>

      {proposal && draftTimetable && (
        <div className="rounded-lg border border-info/30 bg-info/8 p-sm">
          <div className="mb-sm flex flex-wrap items-center justify-between gap-sm">
            <p className="text-sm font-medium text-foreground">Proposed timetable (v{version})</p>
            <div className="flex items-center gap-sm text-xs text-muted-foreground">
              <span>Conflicts: {proposal.conflictCount}</span>
              <span>Filled periods: {proposal.workloadBySection}</span>
            </div>
            <div className="flex gap-xs">
              <Button
                size="sm"
                onClick={() => {
                  applyLocalSlots(proposal.slots);
                  setProposal(null);
                }}
              >
                Load into draft
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                Discard
              </Button>
            </div>
          </div>
          <TimetableGrid timetable={{ ...draftTimetable, slots: proposal.slots }} density={density} />
        </div>
      )}

      {!draftTimetable && !proposal && (
        <p role="status" className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          Setting up this section&apos;s timetable…
        </p>
      )}

      {draftTimetable && !proposal && workingSlots.every((s) => !s.subjectId) && (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
          This timetable is empty — click a period below to add a subject, or use &quot;Regenerate with AI&quot; to auto-fill it.
        </p>
      )}

      {draftTimetable && !proposal && (
        <>
          <div className="md:hidden">
            <MobileDayView timetable={draftTimetable} conflicts={sectionConflicts} editable onSlotClick={setEditSlot} />
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
              timetable={draftTimetable}
              conflicts={sectionConflicts}
              selectedConflict={selectedConflict}
              editable
              density={density}
              showFreeSlots={showFreeSlots}
              visibleDays={dayWindow.visibleDays}
              onSlotClick={setEditSlot}
            />
          </div>
        </>
      )}

      <div className="hidden items-center gap-xs md:flex">
        <Button size="sm" variant="ghost" onClick={() => setShowFreeSlots((v) => !v)}>
          {showFreeSlots ? "Hide free periods" : "Show free periods"}
        </Button>
      </div>

      <div role="status" aria-live="polite" className="sr-only">
        {announcement}
      </div>

      <SlotEditorDrawer
        slot={editSlot ? workingSlots.find((s) => s.id === editSlot.id) ?? editSlot : null}
        slots={workingSlots}
        onOpenChange={(open) => !open && setEditSlot(null)}
        onApply={(next) => applyLocalSlots(next)}
      />

      <ConflictDrawer
        conflict={selectedConflict}
        db={previewDb}
        canManage={canManage}
        onOpenChange={(open) => !open && setSelectedConflict(null)}
        onApply={handleApplyResolution}
        onDismiss={(conflictId, reason) => {
          dismissConflict(conflictId, reason, "Academic Coordinator");
          setSelectedConflict(null);
        }}
      />

      {/* Sticky save bar keeps Save draft / Publish reachable on mobile even with a tall grid above. */}
      <div className="fixed inset-x-0 bottom-[calc(var(--mobile-bottom-nav-height)_+_env(safe-area-inset-bottom))] z-10 flex items-center gap-sm border-t border-border bg-surface p-sm shadow-floating sm:sticky sm:bottom-0 sm:border-t-0 sm:bg-transparent sm:p-0 sm:shadow-none">
        <Button variant="outline" onClick={handleSaveDraft} disabled={!isDirty}>
          Save draft
        </Button>
        <Button onClick={handlePublish} disabled={!draftTimetable}>
          <UploadCloud className="size-3.5" />
          Publish
        </Button>
        {isDirty && (
          <Button variant="ghost" className="ml-auto sm:ml-0" onClick={() => storeTimetable && setWorkingSlots(storeTimetable.slots)}>
            Discard changes
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={pendingSectionId !== null}
        onOpenChange={(open) => !open && setPendingSectionId(null)}
        title="Discard unsaved changes?"
        description="Switching sections will discard the edits you haven't saved to this timetable."
        confirmLabel="Discard and switch"
        destructive
        onConfirm={() => {
          if (pendingSectionId) setSectionId(pendingSectionId);
          setPendingSectionId(null);
        }}
      />

      {saveConfirmation && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 left-1/2 z-30 flex -translate-x-1/2 items-center gap-sm rounded-pill border border-success/30 bg-success/12 px-md py-sm text-xs font-medium text-success shadow-floating sm:bottom-6"
        >
          <UploadCloud className="size-3.5" aria-hidden="true" />
          {saveConfirmation === "published" ? "Timetable published — now live for teachers and students." : "Draft saved."}
        </div>
      )}
    </div>
  );
}

export default function TimetableBuilderPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <TimetableBuilderContent />
    </Suspense>
  );
}
