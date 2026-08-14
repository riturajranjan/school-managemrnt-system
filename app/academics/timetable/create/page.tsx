"use client";

// Timetable builder (Phase 7B.2) — real PostgreSQL/API cutover of the legacy
// builder. Manual scheduling only: click a teaching cell → pick a subject offered
// to the section and one of its assigned teachers → the entry is created on the
// server immediately (no local draft, no mock store). Filled cells can be removed.
// The server prevents section/teacher conflicts and rejects break periods; those
// errors are surfaced inline. Automatic generation, room scheduling, draft/publish
// and undo/redo are deferred (see the honest states below) — PostgreSQL is the
// sole authority, so there is nothing to "publish" and no client history to replay.
import { useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState } from "react";
import { Download, Printer, Sparkles, Trash2 } from "lucide-react";
import Papa from "papaparse";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RealTimetableGrid } from "@/components/academics/timetable/real-timetable-grid";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useClasses, useSections } from "@/lib/hooks/api/use-academics-foundation";
import { useTeachingAssignments } from "@/lib/hooks/api/use-staff";
import { createEntryRequest, deleteEntryRequest, useSectionTimetable } from "@/lib/hooks/api/use-timetable-api";
import type { TimetableEntryDto, TimetablePeriodDto, Weekday } from "@/lib/api/contracts";

const DAY_LABEL: Record<Weekday, string> = { monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday", friday: "Friday", saturday: "Saturday", sunday: "Sunday" };

type Cell = { weekday: Weekday; period: TimetablePeriodDto; entry: TimetableEntryDto | null };

function BuilderContent() {
  const searchParams = useSearchParams();
  const { can } = usePermissions();
  const canManage = can("timetable.manage");
  const { data: classes } = useClasses();
  const { data: sections } = useSections();
  const [sectionId, setSectionId] = useState(searchParams.get("section") ?? "");
  const effectiveSectionId = sectionId || sections[0]?.id || "";
  const { data: timetable, loading, error, reload } = useSectionTimetable(effectiveSectionId || undefined);
  const { data: assignments } = useTeachingAssignments(effectiveSectionId || undefined);
  const [cell, setCell] = useState<Cell | null>(null);
  const className = useMemo(() => new Map(classes.map((c) => [c.id, c.name])), [classes]);

  if (!canManage) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to edit timetables.</p>;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Timetable builder</h1>
          <p className="text-xs text-muted-foreground">Click a period to schedule a lesson — changes save immediately</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
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
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm">
        <p className="text-xs text-muted-foreground">Only subjects offered to this class and their assigned teachers can be scheduled. Room scheduling arrives with the Facilities module.</p>
        <div className="ml-auto flex flex-wrap items-center gap-xs">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              if (!timetable) return;
              const rows = timetable.entries.map((e) => ({ Day: e.weekday, Subject: e.subject.name, Teacher: e.staff.name }));
              const blob = new Blob([Papa.unparse(rows)], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a"); a.href = url; a.download = `timetable-${effectiveSectionId}.csv`; a.click(); URL.revokeObjectURL(url);
            }}
          >
            <Download className="size-3.5" />
            Export
          </Button>
          <Button size="sm" variant="outline" className="hidden md:inline-flex" onClick={() => window.print()}>
            <Printer className="size-3.5" />
            Print
          </Button>
          <Button size="sm" variant="outline" disabled title="Automatic timetable generation is not available yet">
            <Sparkles className="size-3.5" />
            Auto-generate
          </Button>
        </div>
      </div>

      {error ? (
        <p className="rounded-lg border border-error/30 bg-error/10 p-md text-center text-sm text-error">{error}</p>
      ) : loading ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading timetable…</p>
      ) : timetable ? (
        <RealTimetableGrid periods={timetable.periods} weekdays={timetable.weekdays} entries={timetable.entries} editable onCellClick={(weekday, period, entry) => setCell({ weekday, period, entry })} />
      ) : (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Select a class and section to build its timetable.</p>
      )}

      <SlotEditor
        cell={cell}
        sectionId={effectiveSectionId}
        assignments={assignments ?? []}
        onClose={() => setCell(null)}
        onChanged={() => { setCell(null); reload(); }}
      />

      <p className="rounded-lg border border-dashed border-border p-sm text-center text-[11px] text-muted-foreground">
        Automatic generation and draft/publish are deferred — every change is saved to the timetable immediately.
      </p>
    </div>
  );
}

function SlotEditor({ cell, sectionId, assignments, onClose, onChanged }: {
  cell: Cell | null;
  sectionId: string;
  assignments: { subjectId: string; subjectName: string; staffId: string; staffName: string; staffEmployeeCode: string }[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [subjectId, setSubjectId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assignments) seen.set(a.subjectId, a.subjectName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [assignments]);
  const teachers = assignments.filter((a) => a.subjectId === subjectId);

  async function add() {
    if (!cell || !subjectId || !staffId) { setErr("Select a subject and teacher."); return; }
    setBusy(true); setErr(null);
    const res = await createEntryRequest({ sectionId, subjectId, staffId, periodId: cell.period.id, weekday: cell.weekday });
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    setSubjectId(""); setStaffId(""); onChanged();
  }
  async function remove() {
    if (!cell?.entry) return;
    setBusy(true); setErr(null);
    const res = await deleteEntryRequest(cell.entry.id);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    onChanged();
  }

  return (
    <DetailDrawer
      open={cell !== null}
      onOpenChange={(o) => { if (!o) { setSubjectId(""); setStaffId(""); setErr(null); onClose(); } }}
      title={cell ? `${DAY_LABEL[cell.weekday]} · ${cell.period.name}` : ""}
      description={cell ? `${cell.period.startTime}–${cell.period.endTime}` : ""}
    >
      {cell && (
        <div className="flex flex-col gap-sm">
          {err && <p className="text-xs text-error">{err}</p>}
          {cell.entry ? (
            <div className="flex flex-col gap-sm">
              <div className="rounded-lg border border-border p-sm">
                <p className="flex items-center gap-1 text-sm font-medium text-foreground">
                  <span className="inline-block size-2 rounded-pill" style={{ backgroundColor: cell.entry.subject.color }} aria-hidden="true" />
                  {cell.entry.subject.name}
                </p>
                <p className="text-xs text-muted-foreground">{cell.entry.staff.name} · {cell.entry.staff.employeeCode}</p>
              </div>
              <Button variant="ghost" className="self-start text-error" disabled={busy} onClick={() => void remove()}>
                <Trash2 className="size-3.5" />
                Remove lesson
              </Button>
            </div>
          ) : (
            <>
              <div>
                <Label>Subject</Label>
                <Select value={subjectId} onValueChange={(v) => { setSubjectId(v); setStaffId(""); }}>
                  <SelectTrigger aria-label="Subject"><SelectValue placeholder={subjects.length ? "Select subject" : "No assigned teachers yet"} /></SelectTrigger>
                  <SelectContent>{subjects.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Teacher</Label>
                <Select value={staffId} onValueChange={setStaffId} disabled={!subjectId}>
                  <SelectTrigger aria-label="Teacher"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent>{teachers.map((a) => <SelectItem key={a.staffId} value={a.staffId}>{a.staffName} · {a.staffEmployeeCode}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <Button disabled={busy || !subjectId || !staffId} onClick={() => void add()}>Add lesson</Button>
            </>
          )}
        </div>
      )}
    </DetailDrawer>
  );
}

export default function BuilderPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <BuilderContent />
    </Suspense>
  );
}
