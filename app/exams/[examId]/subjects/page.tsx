"use client";

// Exam subject schedule (Phase 8A) — real PostgreSQL/API cutover. Select a real
// Section (from a class this exam applies to) → its real offered Subjects → add/
// edit/remove a scheduled paper. Room / examiner / mark-entry / verification-
// teacher / weightage fields are removed (no real models / Phase 8B+ concerns);
// marks limits are snapshotted from the Subject's current defaults and remain
// editable per paper. Invigilator is optional and independent of the subject's
// TeachingAssignment. Backend conflicts (duplicate subject, one paper/day per
// section, one invigilator/day) are surfaced inline — no client conflict engine.
import { useParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSections } from "@/lib/hooks/api/use-academics-foundation";
import { useSectionSubjects } from "@/lib/hooks/api/use-academics-subjects";
import { useStaff } from "@/lib/hooks/api/use-staff";
import { createScheduleEntryRequest, deleteScheduleEntryRequest, updateScheduleEntryRequest, useExam, useExamSchedule } from "@/lib/hooks/api/use-exams-api";
import type { ExamScheduleEntryDto, SubjectDto } from "@/lib/api/contracts";

export default function ExamSubjectsPage() {
  const params = useParams<{ examId: string }>();
  const { data: exam } = useExam(params.examId);
  const { data: allSections } = useSections();
  const { data: schedule, reload } = useExamSchedule(params.examId);
  const { can } = usePermissions();
  const canManage = can("exams.manageSubjects");

  const examClassIds = useMemo(() => new Set((exam?.classes ?? []).map((c) => c.id)), [exam]);
  const sections = useMemo(() => allSections.filter((s) => examClassIds.has(s.classId)), [allSections, examClassIds]);
  const [sectionId, setSectionId] = useState("");
  const activeSectionId = sectionId || sections[0]?.id || "";
  const { data: offeredSubjects } = useSectionSubjects(activeSectionId || undefined);

  const [target, setTarget] = useState<{ subject: SubjectDto; entry: ExamScheduleEntryDto | null } | null>(null);

  if (!exam) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;

  const scheduleForSection = (schedule ?? []).filter((e) => e.section.id === activeSectionId);
  const byEntry = new Map(scheduleForSection.map((e) => [e.subject.id, e]));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Subjects &amp; schedule — {exam.name}</h1>
        <p className="text-xs text-muted-foreground">Schedule a paper for each real, offered subject of a section</p>
      </div>

      {sections.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Assign classes to this exam first (Configuration on the exam page).</p>
      ) : (
        <>
          <Select value={activeSectionId} onValueChange={setSectionId}>
            <SelectTrigger className="w-64" aria-label="Section"><SelectValue placeholder="Select section" /></SelectTrigger>
            <SelectContent>{sections.map((s) => <SelectItem key={s.id} value={s.id}>{s.className} — Section {s.name}</SelectItem>)}</SelectContent>
          </Select>

          {(offeredSubjects ?? []).length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No subjects are offered to this section&apos;s class yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-secondary/60 text-left text-xs text-muted-foreground">
                    <th className="px-sm py-sm">Subject</th>
                    <th className="px-sm py-sm">Date</th>
                    <th className="px-sm py-sm">Time</th>
                    <th className="px-sm py-sm">Marks</th>
                    <th className="px-sm py-sm">Invigilator</th>
                    <th className="px-sm py-sm text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(offeredSubjects ?? []).map((s) => {
                    const entry = byEntry.get(s.id) ?? null;
                    return (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="px-sm py-sm text-foreground">
                          <span className="mr-2 inline-block size-2 rounded-pill align-middle" style={{ backgroundColor: s.color }} aria-hidden="true" />
                          {s.name}
                        </td>
                        <td className="px-sm py-sm text-muted-foreground">{entry?.examDate ?? "—"}</td>
                        <td className="px-sm py-sm text-muted-foreground">{entry ? `${entry.startTime}–${entry.endTime}` : "—"}</td>
                        <td className="px-sm py-sm text-muted-foreground">{entry ? `${entry.maxMarks} / ${entry.passingMarks}` : "—"}</td>
                        <td className="px-sm py-sm text-muted-foreground">{entry?.invigilator?.name ?? "—"}</td>
                        <td className="px-sm py-sm text-right">
                          {canManage && (
                            <Button size="sm" variant="outline" onClick={() => setTarget({ subject: s, entry })}>
                              {entry ? <Pencil className="size-3.5" /> : <Plus className="size-3.5" />}
                              {entry ? "Edit" : "Schedule"}
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      <ScheduleDrawer
        examId={exam.id}
        sectionId={activeSectionId}
        target={target}
        onClose={() => setTarget(null)}
        onSaved={() => { setTarget(null); reload(); }}
      />
    </div>
  );
}

function ScheduleDrawer({ examId, sectionId, target, onClose, onSaved }: {
  examId: string; sectionId: string; target: { subject: SubjectDto; entry: ExamScheduleEntryDto | null } | null;
  onClose: () => void; onSaved: () => void;
}) {
  const { data: staff } = useStaff();
  const [examDate, setExamDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("11:00");
  const [maxMarks, setMaxMarks] = useState("100");
  const [passingMarks, setPassingMarks] = useState("33");
  const [invigilatorStaffId, setInvigilatorStaffId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function reset(t: typeof target) {
    if (t?.entry) {
      setExamDate(t.entry.examDate); setStartTime(t.entry.startTime); setEndTime(t.entry.endTime);
      setMaxMarks(String(t.entry.maxMarks)); setPassingMarks(String(t.entry.passingMarks));
      setInvigilatorStaffId(t.entry.invigilator?.id ?? "");
    } else if (t) {
      setExamDate(""); setStartTime("09:00"); setEndTime("11:00");
      setMaxMarks(String(t.subject.maxMarks)); setPassingMarks(String(t.subject.passingMarks)); setInvigilatorStaffId("");
    }
    setErr(null);
  }

  // Re-seed the form whenever a new target opens.
  const openKey = target ? `${target.subject.id}:${target.entry?.id ?? "new"}` : "";
  const [lastKey, setLastKey] = useState("");
  if (openKey !== lastKey) { setLastKey(openKey); reset(target); }

  async function save() {
    if (!target) return;
    if (!examDate) { setErr("Select a date."); return; }
    setBusy(true); setErr(null);
    const body = { examDate, startTime, endTime, maxMarks: Number(maxMarks), passingMarks: Number(passingMarks), invigilatorStaffId: invigilatorStaffId || undefined };
    const res = target.entry
      ? await updateScheduleEntryRequest(examId, target.entry.id, body)
      : await createScheduleEntryRequest(examId, { sectionId, subjectId: target.subject.id, ...body });
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    onSaved();
  }
  async function remove() {
    if (!target?.entry) return;
    setBusy(true); setErr(null);
    const res = await deleteScheduleEntryRequest(examId, target.entry.id);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    onSaved();
  }

  return (
    <DetailDrawer open={target !== null} onOpenChange={(o) => !o && onClose()} title={target ? `Schedule — ${target.subject.name}` : ""} description="Real Section + Subject; conflicts are checked on save">
      {target && (
        <div className="flex flex-col gap-sm">
          {err && <p className="text-xs text-error">{err}</p>}
          <div>
            <Label htmlFor="exam-date">Date</Label>
            <Input id="exam-date" type="date" value={examDate} onChange={(e) => setExamDate(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="start-time">Start time</Label>
              <Input id="start-time" type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="end-time">End time</Label>
              <Input id="end-time" type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="max-marks">Max marks</Label>
              <Input id="max-marks" type="number" value={maxMarks} onChange={(e) => setMaxMarks(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="pass-marks">Passing marks</Label>
              <Input id="pass-marks" type="number" value={passingMarks} onChange={(e) => setPassingMarks(e.target.value)} />
            </div>
          </div>
          <div>
            <Label>Invigilator (optional)</Label>
            <Select value={invigilatorStaffId || "__none__"} onValueChange={(v) => setInvigilatorStaffId(v === "__none__" ? "" : v)}>
              <SelectTrigger aria-label="Invigilator"><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {(staff ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.employeeCode}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-sm">
            <Button disabled={busy} onClick={() => void save()}>{target.entry ? "Save changes" : "Schedule paper"}</Button>
            {target.entry && <Button variant="ghost" className="text-error" disabled={busy} onClick={() => void remove()}><Trash2 className="size-3.5" />Remove</Button>}
          </div>
        </div>
      )}
    </DetailDrawer>
  );
}
