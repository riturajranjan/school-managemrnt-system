"use client";

// Real sections + enrollment (Phase 6-pre). Same list/drawer visual idiom as
// before, now backed by /api/academics/* instead of the mock store. Class-teacher
// assignment (which needs real staff/HR — a future module) is intentionally not
// shown here; this page manages the real Section + Enrollment foundation.
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import {
  createSectionRequest,
  enrollStudentsRequest,
  unenrollRequest,
  useClasses,
  useEnrollableStudents,
  useRoster,
  useSections,
} from "@/lib/hooks/api/use-academics-foundation";
import { useSectionSubjects } from "@/lib/hooks/api/use-academics-subjects";
import { assignTeacherRequest, removeTeacherRequest, useTeachingAssignments, useTeachingStaff } from "@/lib/hooks/api/use-staff";
import { createEntryRequest, deleteEntryRequest, useSectionTimetable } from "@/lib/hooks/api/use-timetable-api";
import type { SectionDto, Weekday } from "@/lib/api/contracts";

function SectionsInner() {
  const classIdFilter = useSearchParams().get("classId") ?? undefined;
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const canManage = can("academics.manageClasses");
  const { data: classes } = useClasses();
  const { data: sections, loading, error, reload } = useSections(classIdFilter);
  const [addOpen, setAddOpen] = useState(false);
  const [classId, setClassId] = useState(classIdFilter ?? "");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("40");
  const [rosterSection, setRosterSection] = useState<SectionDto | null>(null);
  const [teachSection, setTeachSection] = useState<SectionDto | null>(null);
  const [ttSection, setTtSection] = useState<SectionDto | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function addSection() {
    setActionError(null);
    const res = await createSectionRequest({ classId, name: name.trim(), capacity: Number(capacity) || 40 });
    if (!res.success) { setActionError(res.error.message); return; }
    setName(""); setAddOpen(false); reload();
  }

  if (!capabilitiesLoading && !hasServerPermission("academics.view")) {
    return <PermissionDenied action="view sections" role={roleLabels[role]} backHref="/academics" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Sections</h1>
          <p className="text-xs text-muted-foreground">Every section across all classes</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setClassId(classIdFilter ?? ""); setAddOpen(true); }}>
            <Plus className="size-3.5" />
            Add section
          </Button>
        )}
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load sections: {error}</div>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading sections…</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-sm">
          {sections.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No sections yet.</p>}
          {sections.map((s) => (
            <div key={s.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-medium text-foreground">{s.className} — Section {s.name}</p>
                <p className="text-xs text-muted-foreground">{s.enrolledCount}/{s.capacity} students</p>
              </div>
              <div className="flex items-center gap-sm">
                <Badge tone={s.status === "active" ? "success" : "neutral"}>{s.status}</Badge>
                <Button size="sm" variant="outline" onClick={() => setTeachSection(s)}>Teachers</Button>
                <Button size="sm" variant="outline" onClick={() => setTtSection(s)}>Timetable</Button>
                <Button size="sm" variant="outline" onClick={() => setRosterSection(s)}>Manage roster</Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <DetailDrawer open={addOpen} onOpenChange={setAddOpen} title="Add section" description="Create a new section within a class">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger aria-label="Class"><SelectValue placeholder="Select class" /></SelectTrigger>
              <SelectContent>{classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="section-name">Section name</Label>
            <Input id="section-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. C" />
          </div>
          <div>
            <Label htmlFor="section-capacity">Capacity</Label>
            <Input id="section-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <Button disabled={!classId || !name.trim()} onClick={() => void addSection()}>Add section</Button>
        </div>
      </DetailDrawer>

      <RosterDrawer section={rosterSection} onClose={() => { setRosterSection(null); reload(); }} canManage={canManage} />
      <TeachersDrawer section={teachSection} onClose={() => setTeachSection(null)} canManage={canManage} />
      <TimetableDrawer section={ttSection} onClose={() => setTtSection(null)} canManage={can("timetable.manage")} />
    </div>
  );
}

const WEEKDAY_LABEL: Record<Weekday, string> = { monday: "Mon", tuesday: "Tue", wednesday: "Wed", thursday: "Thu", friday: "Fri", saturday: "Sat", sunday: "Sun" };

/** Real section timetable: real bell periods, real ClassSubject-derived subjects,
 *  teachers constrained by real TeachingAssignments; server prevents conflicts. */
function TimetableDrawer({ section, onClose, canManage }: { section: SectionDto | null; onClose: () => void; canManage: boolean }) {
  const { data: timetable, loading, reload } = useSectionTimetable(section?.id);
  const { data: assignments } = useTeachingAssignments(section?.id);
  const [weekday, setWeekday] = useState<Weekday>("monday");
  const [periodId, setPeriodId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const teachingPeriods = (timetable?.periods ?? []).filter((p) => p.type === "teaching");
  const subjects = useMemo(() => {
    const seen = new Map<string, string>();
    for (const a of assignments ?? []) seen.set(a.subjectId, a.subjectName);
    return [...seen.entries()].map(([id, name]) => ({ id, name }));
  }, [assignments]);
  const teachersForSubject = (assignments ?? []).filter((a) => a.subjectId === subjectId);
  const entries = timetable?.entries ?? [];

  async function add() {
    if (!section || !periodId || !subjectId || !staffId) { setErr("Select a period, subject and teacher."); return; }
    setBusy(true); setErr(null);
    const res = await createEntryRequest({ sectionId: section.id, subjectId, staffId, periodId, weekday });
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    setSubjectId(""); setStaffId(""); reload();
  }
  async function remove(entryId: string) {
    setBusy(true); setErr(null);
    const res = await deleteEntryRequest(entryId);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    reload();
  }

  return (
    <DetailDrawer open={Boolean(section)} onOpenChange={(o) => { if (!o) { setErr(null); setSubjectId(""); setStaffId(""); onClose(); } }} title={section ? `${section.className} — Section ${section.name}` : ""} description="Weekly timetable (real periods, subjects and assigned teachers)">
      <div className="flex flex-col gap-sm">
        {err && <p className="text-xs text-error">{err}</p>}
        {canManage && (
          <div className="flex flex-col gap-sm rounded-lg border border-border p-sm">
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label>Weekday</Label>
                <Select value={weekday} onValueChange={(v) => setWeekday(v as Weekday)}>
                  <SelectTrigger aria-label="Weekday"><SelectValue /></SelectTrigger>
                  <SelectContent>{(timetable?.weekdays ?? []).map((d) => <SelectItem key={d} value={d}>{WEEKDAY_LABEL[d]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Period</Label>
                <Select value={periodId} onValueChange={setPeriodId}>
                  <SelectTrigger aria-label="Period"><SelectValue placeholder="Period" /></SelectTrigger>
                  <SelectContent>{teachingPeriods.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.startTime}–{p.endTime})</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
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
                <SelectContent>{teachersForSubject.map((a) => <SelectItem key={a.staffId} value={a.staffId}>{a.staffName} · {a.staffEmployeeCode}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">Only subjects offered to this class and their assigned teachers can be scheduled. Room scheduling arrives with the Facilities module.</p>
            <Button size="sm" disabled={busy || !periodId || !subjectId || !staffId} onClick={() => void add()}>Add lesson</Button>
          </div>
        )}
        {loading ? (
          <p className="py-lg text-center text-sm text-muted-foreground">Loading timetable…</p>
        ) : entries.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No lessons scheduled yet.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {entries.map((e) => {
              const period = (timetable?.periods ?? []).find((p) => p.id === e.periodId);
              return (
                <li key={e.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-foreground"><span className="mr-2 inline-block size-2 rounded-pill align-middle" style={{ backgroundColor: e.subject.color }} aria-hidden="true" />{e.subject.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{WEEKDAY_LABEL[e.weekday]} · {period?.name ?? "—"} · {e.staff.name}</p>
                  </div>
                  {canManage && <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => void remove(e.id)} aria-label="Remove lesson"><Trash2 className="size-3.5" /></Button>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </DetailDrawer>
  );
}

/** Real teacher assignments for a section: assign an ACTIVE teaching Staff to an
 *  inherited Subject. Teachers come from getTeachingStaff; subjects from the real
 *  Section→Class→ClassSubject inheritance. No mock teacher data. */
function TeachersDrawer({ section, onClose, canManage }: { section: SectionDto | null; onClose: () => void; canManage: boolean }) {
  const { data: assignments, loading, reload } = useTeachingAssignments(section?.id);
  const { data: subjects } = useSectionSubjects(section?.id);
  const { data: teachers } = useTeachingStaff(Boolean(section));
  const [subjectId, setSubjectId] = useState("");
  const [staffId, setStaffId] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const rows = assignments ?? [];

  async function assign() {
    if (!section || !subjectId || !staffId) { setErr("Select a subject and a teacher."); return; }
    setBusy(true); setErr(null);
    const res = await assignTeacherRequest(section.id, subjectId, staffId);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    setSubjectId(""); setStaffId(""); reload();
  }
  async function remove(assignmentId: string) {
    if (!section) return;
    setBusy(true); setErr(null);
    const res = await removeTeacherRequest(section.id, assignmentId);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    reload();
  }

  return (
    <DetailDrawer open={Boolean(section)} onOpenChange={(o) => { if (!o) { setSubjectId(""); setStaffId(""); setErr(null); onClose(); } }} title={section ? `${section.className} — Section ${section.name}` : ""} description="Assign teachers to this section's subjects">
      <div className="flex flex-col gap-sm">
        {err && <p className="text-xs text-error">{err}</p>}
        {canManage && (
          <div className="flex flex-col gap-sm rounded-lg border border-border p-sm">
            <div>
              <Label>Subject</Label>
              <Select value={subjectId} onValueChange={setSubjectId}>
                <SelectTrigger aria-label="Subject"><SelectValue placeholder="Select subject" /></SelectTrigger>
                <SelectContent>{(subjects ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Teacher</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Teacher"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                <SelectContent>{(teachers ?? []).map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {t.employeeCode}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={busy || !subjectId || !staffId} onClick={() => void assign()}>Assign teacher</Button>
          </div>
        )}
        {loading ? (
          <p className="py-lg text-center text-sm text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No teachers assigned yet.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {rows.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
                <div className="min-w-0"><p className="truncate font-medium text-foreground">{a.subjectName}</p><p className="truncate text-xs text-muted-foreground">{a.staffName} · {a.staffEmployeeCode}</p></div>
                {canManage && <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => void remove(a.id)} aria-label={`Remove ${a.staffName}`}><Trash2 className="size-3.5" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailDrawer>
  );
}

function RosterDrawer({ section, onClose, canManage }: { section: SectionDto | null; onClose: () => void; canManage: boolean }) {
  const { data: roster, loading, reload } = useRoster(section?.id);
  const { data: enrollable, reload: reloadEnrollable } = useEnrollableStudents(Boolean(section));
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const rosterRows = useMemo(() => roster ?? [], [roster]);

  async function enroll() {
    if (!section || !selected) return;
    setBusy(true); setErr(null);
    const res = await enrollStudentsRequest(section.id, [selected]);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    setSelected(""); reload(); reloadEnrollable();
  }
  async function remove(enrollmentId: string) {
    setBusy(true); setErr(null);
    const res = await unenrollRequest(enrollmentId);
    setBusy(false);
    if (!res.success) { setErr(res.error.message); return; }
    reload(); reloadEnrollable();
  }

  return (
    <DetailDrawer open={Boolean(section)} onOpenChange={(o) => { if (!o) onClose(); }} title={section ? `${section.className} — Section ${section.name}` : ""} description="Manage enrolled students">
      <div className="flex flex-col gap-sm">
        {err && <p className="text-xs text-error">{err}</p>}
        {canManage && (
          <div className="flex items-end gap-sm">
            <div className="flex-1">
              <Label>Enroll student</Label>
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger aria-label="Student"><SelectValue placeholder="Select a student" /></SelectTrigger>
                <SelectContent>{(enrollable ?? []).map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.admissionNumber}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button size="sm" disabled={busy || !selected} onClick={() => void enroll()}>Enroll</Button>
          </div>
        )}
        {loading ? (
          <p className="py-lg text-center text-sm text-muted-foreground">Loading roster…</p>
        ) : rosterRows.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No students enrolled.</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {rosterRows.map((r) => (
              <li key={r.enrollmentId} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
                <div className="min-w-0"><p className="truncate font-medium text-foreground">{r.student.name}</p><p className="truncate text-xs text-muted-foreground">{r.student.admissionNumber}</p></div>
                {canManage && <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => void remove(r.enrollmentId)}><Trash2 className="size-3.5" /></Button>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </DetailDrawer>
  );
}

export default function SectionsPage() {
  return (
    <Suspense fallback={<div className="py-2xl text-center text-sm text-muted-foreground">Loading…</div>}>
      <SectionsInner />
    </Suspense>
  );
}
