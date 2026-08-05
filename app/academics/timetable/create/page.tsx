"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Copy, Lock, Sparkles, Trash2, Unlock, UploadCloud } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TimetableGrid } from "@/components/academics/timetable/timetable-grid";
import { usePermissions } from "@/components/providers/permissions-provider";
import { rooms, subjects, teachers } from "@/lib/data/seed/academics";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useSectionTimetable, useTimetableConflicts } from "@/lib/hooks/use-timetable";
import {
  clearSlot,
  copyDay,
  createTimetableIfMissing,
  proposeTimetable,
  publishTimetable,
  saveProposedTimetable,
  toggleSlotLock,
  updateSlot,
  type ProposedTimetable,
} from "@/lib/services/timetable-service";
import { weekDays, type TimetableSlot, type WeekDay } from "@/lib/types/timetable";

function TimetableBuilderContent() {
  const searchParams = useSearchParams();
  const classes = useManagedClasses();
  const conflicts = useTimetableConflicts();
  const { can } = usePermissions();

  const initialSectionId = searchParams.get("section") ?? classes[6]?.sections[0]?.id ?? "";
  const [sectionId, setSectionId] = useState(initialSectionId);
  const schoolClass = classes.find((c) => c.sections.some((s) => s.id === sectionId));
  const timetable = useSectionTimetable(sectionId);

  const [editSlot, setEditSlot] = useState<TimetableSlot | null>(null);
  const [copyFrom, setCopyFrom] = useState<WeekDay>("Monday");
  const [copyTo, setCopyTo] = useState<WeekDay>("Tuesday");
  const [proposal, setProposal] = useState<ProposedTimetable | null>(null);
  const [version, setVersion] = useState(1);

  useEffect(() => {
    if (sectionId && schoolClass && !timetable) {
      createTimetableIfMissing(schoolClass.id, sectionId, CURRENT_SESSION, "main");
    }
  }, [sectionId, schoolClass, timetable]);

  const sectionConflicts = useMemo(
    () => conflicts.filter((c) => timetable && c.slotIds.some((id) => timetable.slots.some((s) => s.id === id))),
    [conflicts, timetable],
  );

  if (!can("timetable.manage")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to edit timetables.</p>;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Timetable builder</h1>
          <p className="text-xs text-muted-foreground">Click a slot to edit it</p>
        </div>
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
      </div>

      {sectionConflicts.length > 0 && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-error/30 bg-error/10 px-sm py-sm text-xs text-error">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">{sectionConflicts.length} conflict(s):</span>
          {sectionConflicts.map((c) => (
            <span key={c.id}>
              {c.description} ({c.day} P{c.periodIndex})
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm">
        <span className="text-xs font-medium text-foreground">Copy day:</span>
        <Select value={copyFrom} onValueChange={(v) => setCopyFrom(v as WeekDay)}>
          <SelectTrigger className="w-32" aria-label="Copy from day">
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
        <Select value={copyTo} onValueChange={(v) => setCopyTo(v as WeekDay)}>
          <SelectTrigger className="w-32" aria-label="Copy to day">
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
        <Button size="sm" variant="outline" onClick={() => timetable && copyDay(timetable.id, copyFrom, copyTo)}>
          <Copy className="size-3.5" />
          Copy
        </Button>

        <Button
          size="sm"
          variant="outline"
          className="ml-auto"
          onClick={() => {
            const next = version + 1;
            setVersion(next);
            setProposal(proposeTimetable(sectionId, next));
          }}
        >
          <Sparkles className="size-3.5" />
          Regenerate with AI
        </Button>
        {timetable?.status === "draft" && (
          <Button size="sm" onClick={() => timetable && publishTimetable(timetable.id)}>
            <UploadCloud className="size-3.5" />
            Publish
          </Button>
        )}
        {timetable?.status === "published" && <Badge tone="success">Published</Badge>}
      </div>

      {proposal && (
        <div className="rounded-lg border border-info/30 bg-info/10 p-sm">
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
                  if (timetable) saveProposedTimetable(timetable.id, proposal.slots);
                  setProposal(null);
                }}
              >
                <CheckCircle2 className="size-3.5" />
                Accept proposal
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setProposal(null)}>
                Discard
              </Button>
            </div>
          </div>
          <TimetableGrid timetable={{ ...timetable!, slots: proposal.slots }} />
        </div>
      )}

      {timetable && !proposal && <TimetableGrid timetable={timetable} conflicts={conflicts} onSlotClick={setEditSlot} />}

      <DetailDrawer open={editSlot !== null} onOpenChange={(open) => !open && setEditSlot(null)} title={editSlot ? `${editSlot.day} · Period ${editSlot.periodIndex}` : ""} description="Edit this period">
        {editSlot && timetable && (
          <div className="flex flex-col gap-sm">
            <div>
              <p className="mb-xs text-xs font-medium text-foreground">Subject</p>
              <Select value={editSlot.subjectId ?? ""} onValueChange={(v) => updateSlot(timetable.id, editSlot.id, { subjectId: v })}>
                <SelectTrigger aria-label="Subject">
                  <SelectValue placeholder="No subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-xs text-xs font-medium text-foreground">Teacher</p>
              <Select value={editSlot.teacherId ?? ""} onValueChange={(v) => updateSlot(timetable.id, editSlot.id, { teacherId: v })}>
                <SelectTrigger aria-label="Teacher">
                  <SelectValue placeholder="No teacher" />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <p className="mb-xs text-xs font-medium text-foreground">Room</p>
              <Select value={editSlot.roomId ?? ""} onValueChange={(v) => updateSlot(timetable.id, editSlot.id, { roomId: v })}>
                <SelectTrigger aria-label="Room">
                  <SelectValue placeholder="No room" />
                </SelectTrigger>
                <SelectContent>
                  {rooms.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-sm pt-sm">
              <Button
                variant="outline"
                onClick={() => {
                  toggleSlotLock(timetable.id, editSlot.id);
                  setEditSlot(null);
                }}
              >
                {editSlot.locked ? <Unlock className="size-3.5" /> : <Lock className="size-3.5" />}
                {editSlot.locked ? "Unlock" : "Lock"}
              </Button>
              <Button
                variant="outline"
                className="text-error"
                onClick={() => {
                  clearSlot(timetable.id, editSlot.id);
                  setEditSlot(null);
                }}
              >
                <Trash2 className="size-3.5" />
                Clear
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
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
