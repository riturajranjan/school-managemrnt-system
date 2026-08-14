"use client";

// Exam detail (Phase 8A/8B) — real PostgreSQL/API cutover. Same stage-card shell
// as before; Subjects/Schedule (8A) and Marks entry (8B) are real. Students/
// Attendance/Results/Publish depend on modules not built yet (Phase 8B roster
// management / Phase 8C) and show an honest "not available yet" state instead of
// a fabricated readiness %.
// Grading scheme / Result rule / Report card template / audit-log UI are removed
// (no real models / no bespoke entity-audit reader in this phase — real AuditEvent
// rows are still written server-side). "Delete" is replaced by Archive, matching
// this codebase's status-based convention elsewhere (Subjects, Staff, …).
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { AlertTriangle, CalendarClock, ChevronRight, ClipboardCheck, FileBadge, FileText, Pencil, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { useClasses } from "@/lib/hooks/api/use-academics-foundation";
import { reconcileExamClassesRequest, setExamStatusRequest, updateExamRequest, useExam, useExamSchedule } from "@/lib/hooks/api/use-exams-api";
import { usePermissions } from "@/components/providers/permissions-provider";
import { formatDate } from "@/lib/utils";

const examTypeLabels: Record<string, string> = {
  "unit-test": "Unit test", "weekly-test": "Weekly test", "monthly-test": "Monthly test", midterm: "Midterm", "half-yearly": "Half-yearly",
  annual: "Annual", "pre-board": "Pre-board", board: "Board examination", practical: "Practical", oral: "Oral", assignment: "Assignment",
  project: "Project", "internal-assessment": "Internal assessment", custom: "Custom",
};
const examStatusLabels: Record<string, string> = { draft: "Draft", scheduled: "Scheduled", completed: "Completed", archived: "Archived" };
const examStatusTone: Record<string, "neutral" | "info" | "success"> = { draft: "neutral", scheduled: "info", completed: "success", archived: "neutral" };

export default function ExamDetailPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();
  const { data: exam, loading, error, reload } = useExam(params.examId);
  const { data: schedule } = useExamSchedule(params.examId);
  const { data: classes } = useClasses();
  const { can } = usePermissions();
  const canManage = can("exams.manageSchedule");

  const [editOpen, setEditOpen] = useState(false);
  const [classesOpen, setClassesOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading exam…</p>;
  if (error || !exam) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error ?? "Exam not found."}</p>;
  }

  const scheduleCount = schedule?.length ?? exam.scheduleCount;
  const stageCards = [
    { key: "subjects", label: "Subjects & schedule", href: `/exams/${exam.id}/subjects`, icon: FileText, real: true, detail: `${scheduleCount} paper${scheduleCount === 1 ? "" : "s"} scheduled` },
    { key: "schedule", label: "Schedule view", href: `/exams/${exam.id}/schedule`, icon: CalendarClock, real: true, detail: "By date" },
    { key: "students", label: "Students", href: `/exams/${exam.id}/students`, icon: Users, real: false, detail: "Not available yet" },
    { key: "attendance", label: "Attendance", href: `/exams/${exam.id}/attendance`, icon: ClipboardCheck, real: false, detail: "Not available yet" },
    { key: "marks", label: "Marks entry", href: `/marks/entry?examId=${exam.id}`, icon: FileBadge, real: true, detail: `${scheduleCount} paper${scheduleCount === 1 ? "" : "s"} scheduled` },
  ] as const;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-xs">
            <h1 className="text-lg font-semibold text-foreground">{exam.name}</h1>
            <Badge tone={examStatusTone[exam.status]}>{examStatusLabels[exam.status]}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {exam.code} · {examTypeLabels[exam.type]} · {exam.term.name} · {formatDate(exam.startsOn)} – {formatDate(exam.endsOn)}
          </p>
        </div>
        {canManage && (
          <div className="flex items-center gap-xs">
            <Button size="sm" variant="outline" onClick={() => setEditOpen(true)}>
              <Pencil className="size-3.5" />
              Edit
            </Button>
            {exam.status !== "archived" && (
              <Button size="sm" variant="outline" className="text-error" onClick={() => setConfirmArchive(true)}>
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      {exam.description && <p className="rounded-lg border border-border bg-surface-secondary/40 p-sm text-sm text-muted-foreground">{exam.description}</p>}
      {actionError && (
        <div className="flex items-center gap-sm rounded-lg border border-error/30 bg-error/8 px-sm py-sm text-sm text-error">
          <AlertTriangle className="size-4 shrink-0" />
          {actionError}
        </div>
      )}
      {scheduleCount === 0 && (
        <div className="flex items-center gap-sm rounded-lg border border-warning/30 bg-warning/8 px-sm py-sm text-sm text-warning">
          <AlertTriangle className="size-4 shrink-0" />
          No papers scheduled yet — start with Subjects &amp; schedule below.
        </div>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-4">
        {stageCards.map((card) => (
          <Link
            key={card.key}
            href={card.href}
            className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-between">
              <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                <card.icon className="size-4" aria-hidden="true" />
              </span>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{card.label}</p>
              <p className="text-xs text-muted-foreground">{card.detail}</p>
            </div>
            <Badge tone={card.real ? "success" : "neutral"}>{card.real ? "Real" : "Deferred"}</Badge>
          </Link>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <div className="mb-sm flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Configuration</h2>
          {canManage && <Button size="sm" variant="outline" onClick={() => setClassesOpen(true)}>Manage classes</Button>}
        </div>
        <div className="grid grid-cols-1 gap-sm text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs text-muted-foreground">Classes</p>
            <p className="text-foreground">{exam.classes.map((c) => c.name).join(", ") || "None selected"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Scope / Mode</p>
            <p className="text-foreground capitalize">{exam.scope} · {exam.mode}</p>
          </div>
        </div>
        <p className="mt-sm text-xs text-muted-foreground">Grading scheme, result rules and report card templates arrive with the Marks &amp; Results module.</p>
      </div>

      <DetailDrawer open={editOpen} onOpenChange={setEditOpen} title="Edit exam details" description={exam.code}>
        <ExamEditForm exam={exam} onSaved={() => { setEditOpen(false); reload(); }} onError={setActionError} />
      </DetailDrawer>

      <DetailDrawer open={classesOpen} onOpenChange={setClassesOpen} title="Assign classes" description="Which real classes this exam applies to">
        <ClassAssignForm examId={exam.id} classes={classes} assigned={exam.classes} onSaved={() => { setClassesOpen(false); reload(); }} onError={setActionError} />
      </DetailDrawer>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this exam?"
        description="Archived exams stay in history but are no longer editable in the active list."
        confirmLabel="Archive exam"
        destructive
        onConfirm={async () => {
          setConfirmArchive(false);
          const res = await setExamStatusRequest(exam.id, "archived");
          if (!res.success) { setActionError(res.error.message); return; }
          router.push("/exams");
        }}
      />
    </div>
  );
}

function ExamEditForm({ exam, onSaved, onError }: { exam: { id: string; name: string; code: string; description: string | null; startsOn: string; endsOn: string }; onSaved: () => void; onError: (e: string | null) => void }) {
  const [name, setName] = useState(exam.name);
  const [code, setCode] = useState(exam.code);
  const [description, setDescription] = useState(exam.description ?? "");
  const [startsOn, setStartsOn] = useState(exam.startsOn);
  const [endsOn, setEndsOn] = useState(exam.endsOn);
  const [busy, setBusy] = useState(false);
  const invalid = !name.trim() || !code.trim();

  async function save() {
    if (invalid) return;
    setBusy(true); onError(null);
    const res = await updateExamRequest(exam.id, { name: name.trim(), code: code.trim(), description: description || null, startsOn, endsOn });
    setBusy(false);
    if (!res.success) { onError(res.error.message); return; }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-sm">
      <div>
        <Label htmlFor="edit-name">Exam name</Label>
        <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
        <FieldError>{!name.trim() ? "Required" : undefined}</FieldError>
      </div>
      <div>
        <Label htmlFor="edit-code">Code</Label>
        <Input id="edit-code" value={code} onChange={(e) => setCode(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="edit-desc">Description</Label>
        <Textarea id="edit-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <div>
          <Label htmlFor="edit-start">Start</Label>
          <Input id="edit-start" type="date" value={startsOn} onChange={(e) => setStartsOn(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="edit-end">End</Label>
          <Input id="edit-end" type="date" value={endsOn} onChange={(e) => setEndsOn(e.target.value)} />
        </div>
      </div>
      <Button disabled={busy || invalid} onClick={() => void save()}>Save changes</Button>
    </div>
  );
}

function ClassAssignForm({ examId, classes, assigned, onSaved, onError }: { examId: string; classes: { id: string; name: string }[]; assigned: { id: string; name: string }[]; onSaved: () => void; onError: (e: string | null) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set(assigned.map((c) => c.id)));
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function save() {
    setBusy(true); onError(null);
    const res = await reconcileExamClassesRequest(examId, [...selected]);
    setBusy(false);
    if (!res.success) { onError(res.error.message); return; }
    onSaved();
  }

  return (
    <div className="flex flex-col gap-sm">
      <ul className="flex flex-col gap-1">
        {classes.map((c) => (
          <li key={c.id}>
            <label className="flex items-center gap-sm rounded-md border border-border p-sm text-sm">
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} className="size-4" />
              <span className="text-foreground">{c.name}</span>
            </label>
          </li>
        ))}
      </ul>
      <Button disabled={busy} onClick={() => void save()}>Save classes</Button>
    </div>
  );
}
