"use client";

// Student 360 — real-data profile. Reads GET /api/students/[id]; the tabs shown
// here (Overview, Guardians, Documents, Timeline) are the sections Phase 4 owns,
// plus a real Attendance tab (Phase 5) backed by GET /api/students/[id]/attendance.
// Fees / Academics / Transport / Health / Library etc. are intentionally NOT shown
// as real here — they arrive with their own module migrations, and are never faked
// against this real record (§8).
import Link from "next/link";
import { useState } from "react";
import { Archive, Mail, Pencil, Phone, Plus, Trash2, UserPlus } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/components/providers/permissions-provider";
import { studentStatusTone } from "@/components/students/student-meta";
import {
  archiveStudentRequest,
  linkGuardianRequest,
  unlinkGuardianRequest,
  useStudentDetail,
} from "@/lib/hooks/api/use-students";
import { useStudentAttendance } from "@/lib/hooks/api/use-attendance";
import type { StudentDetailDto } from "@/lib/api/contracts";
import { studentStatusLabels, type StudentStatus } from "@/lib/types/students";
import { attendanceStatusLabels, attendanceStatusTone, type AttendanceStatus } from "@/lib/types/attendance";
import { initialsOf } from "@/lib/utils";

const REAL_TABS = new Set(["overview", "guardians", "documents", "timeline", "attendance"]);

export function StudentProfile({ studentId, initialTab = "overview" }: { studentId: string; initialTab?: string }) {
  const { can } = usePermissions();
  const { data: student, loading, error, reload } = useStudentDetail(studentId);
  const [activeTab, setActiveTab] = useState(REAL_TABS.has(initialTab) ? initialTab : "overview");
  const [confirmArchive, setConfirmArchive] = useState(false);

  if (loading) return <div className="py-2xl text-center text-sm text-muted-foreground">Loading student…</div>;
  if (error || !student) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ? "Could not load student" : "Student not found"}</p>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        <Button asChild variant="outline">
          <Link href="/students">Back to Students</Link>
        </Button>
      </div>
    );
  }

  async function onArchive() {
    await archiveStudentRequest(studentId);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <ProfileHeader student={student} canEdit={can("students.edit")} onArchive={() => setConfirmArchive(true)} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <OverviewSection student={student} />
        </TabsContent>
        <TabsContent value="guardians" className="mt-md">
          <GuardiansSection student={student} canEdit={can("students.edit")} onChanged={reload} />
        </TabsContent>
        <TabsContent value="documents" className="mt-md">
          <DocumentsSection student={student} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-md">
          <AttendanceSection studentId={student.id} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-md">
          <TimelineSection student={student} />
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this student?"
        description="Archived students are hidden from active rosters but their records are preserved."
        confirmLabel="Archive"
        destructive
        onConfirm={() => void onArchive()}
      />

      {/* Deliberately no fees / academics sections — those are owned by future
          module phases and are not faked against this real record. */}
      <p className="text-xs text-muted-foreground">
        Fees, academics, transport and health for this student appear once those modules are migrated.
      </p>
    </div>
  );
}

function ProfileHeader({ student, canEdit, onArchive }: { student: StudentDetailDto; canEdit: boolean; onArchive: () => void }) {
  const cls = [student.classLabel, student.sectionLabel].filter(Boolean).join(" · ") || "—";
  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
      <div className="flex items-start gap-sm">
        <Avatar className="size-14">
          <AvatarFallback>{initialsOf(student.firstName, student.lastName)}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex flex-wrap items-center gap-xs">
            <h1 className="text-base font-semibold text-foreground">{student.fullName}</h1>
            <Badge tone={studentStatusTone[student.status as StudentStatus] ?? "neutral"}>
              {studentStatusLabels[student.status as StudentStatus] ?? student.status}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {student.admissionNumber} · {cls}
            {student.rollNumber ? ` · Roll ${student.rollNumber}` : ""}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1 text-xs text-muted-foreground">
            {student.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {student.phone}
              </span>
            )}
            {student.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {student.email}
              </span>
            )}
          </div>
        </div>
      </div>
      {canEdit && (
        <div className="flex flex-wrap items-center gap-xs">
          <Button asChild size="sm" variant="outline">
            <Link href={`/students/${student.id}/edit`}>
              <Pencil className="size-3.5" /> Edit
            </Link>
          </Button>
          {student.status !== "archived" && (
            <Button size="sm" variant="outline" className="text-error" onClick={onArchive}>
              <Archive className="size-3.5" /> Archive
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

function OverviewSection({ student }: { student: StudentDetailDto }) {
  const addr = student.address;
  const addressLine = [addr.line1, addr.line2, addr.city, addr.state, addr.postalCode, addr.country].filter(Boolean).join(", ");
  return (
    <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Identity</h2>
        <div className="grid grid-cols-2 gap-sm">
          <Field label="Preferred name" value={student.preferredName} />
          <Field label="Gender" value={student.gender.replace(/-/g, " ")} />
          <Field label="Date of birth" value={new Date(student.dateOfBirth).toLocaleDateString("en-IN")} />
          <Field label="Blood group" value={student.bloodGroup} />
          <Field label="Nationality" value={student.nationality} />
          <Field label="Religion" value={student.religion} />
          <Field label="Category" value={student.category} />
          <Field label="Mother tongue" value={student.motherTongue} />
          <Field label="House" value={student.house} />
        </div>
      </div>
      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Enrolment</h2>
        <div className="grid grid-cols-2 gap-sm">
          <Field label="Admission number" value={student.admissionNumber} />
          <Field label="Admission type" value={student.admissionType.replace(/-/g, " ")} />
          <Field label="Admission date" value={new Date(student.admissionDate).toLocaleDateString("en-IN")} />
          <Field label="Roll number" value={student.rollNumber} />
          <Field label="Class" value={[student.classLabel, student.sectionLabel].filter(Boolean).join(" · ")} />
        </div>
        {student.admission && (
          <p className="mt-sm text-xs text-muted-foreground">
            Enrolled from application{" "}
            <Link href={`/admissions/${student.admission.id}`} className="font-medium text-foreground hover:underline">
              {student.admission.applicationNumber}
            </Link>
          </p>
        )}
        <div className="mt-sm">
          <Field label="Address" value={addressLine} />
        </div>
      </div>
    </div>
  );
}

function GuardiansSection({ student, canEdit, onChanged }: { student: StudentDetailDto; canEdit: boolean; onChanged: () => void }) {
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", relation: "guardian" });

  async function submit() {
    setBusy(true);
    setErr(null);
    const body = {
      guardian: {
        firstName: form.firstName,
        lastName: form.lastName,
        email: form.email || undefined,
        phone: form.phone || undefined,
      },
      relation: form.relation,
    };
    const res = await linkGuardianRequest(student.id, body);
    setBusy(false);
    if (!res.success) {
      setErr(res.error.message);
      return;
    }
    setAdding(false);
    setForm({ firstName: "", lastName: "", email: "", phone: "", relation: "guardian" });
    onChanged();
  }

  async function unlink(guardianId: string) {
    setBusy(true);
    await unlinkGuardianRequest(student.id, guardianId);
    setBusy(false);
    onChanged();
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-foreground">Guardians</h2>
        {canEdit && !adding && (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <UserPlus className="size-3.5" /> Link guardian
          </Button>
        )}
      </div>

      {adding && (
        <div className="flex flex-col gap-sm rounded-lg border border-border p-sm">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="g-first">First name</Label>
              <Input id="g-first" value={form.firstName} onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="g-last">Last name</Label>
              <Input id="g-last" value={form.lastName} onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="g-email">Email</Label>
              <Input id="g-email" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor="g-phone">Phone</Label>
              <Input id="g-phone" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>Relation</Label>
              <Select value={form.relation} onValueChange={(v) => setForm((f) => ({ ...f, relation: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="father">Father</SelectItem>
                  <SelectItem value="mother">Mother</SelectItem>
                  <SelectItem value="guardian">Guardian</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {err && <p className="text-xs text-error">{err}</p>}
          <div className="flex gap-xs">
            <Button size="sm" disabled={busy || !form.firstName || !form.lastName} onClick={() => void submit()}>
              <Plus className="size-3.5" /> Link
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <ul className="flex flex-col gap-sm">
        {student.guardians.map((g) => (
          <li key={g.guardian.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
            <Link href={`/parents/${g.guardian.id}`} className="min-w-0 flex-1 hover:underline">
              <p className="truncate text-sm font-medium text-foreground">
                {g.guardian.fullName}
                {g.link.isPrimary && <Badge tone="info" className="ml-xs">Primary</Badge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {g.link.relation}
                {g.guardian.phone ? ` · ${g.guardian.phone}` : ""}
                {g.link.authorizedPickup ? " · pickup" : ""}
                {g.link.isFeeResponsible ? " · fee payer" : ""}
              </p>
            </Link>
            {canEdit && (
              <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => void unlink(g.guardian.id)}>
                <Trash2 className="size-3.5" />
              </Button>
            )}
          </li>
        ))}
        {student.guardians.length === 0 && <p className="text-sm text-muted-foreground">No guardians linked yet.</p>}
      </ul>
    </div>
  );
}

function DocumentsSection({ student }: { student: StudentDetailDto }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Documents</h2>
      <ul className="flex flex-col gap-sm">
        {student.documents.map((d) => (
          <li key={d.id} className="flex items-center justify-between gap-sm text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">{d.displayName}</p>
              <p className="text-xs text-muted-foreground">{d.type}</p>
            </div>
            <div className="flex items-center gap-xs">
              <Badge tone={d.status === "uploaded" ? "success" : "neutral"}>{d.status}</Badge>
              <Badge tone={d.verificationStatus === "verified" ? "success" : d.verificationStatus === "rejected" ? "error" : "warning"}>
                {d.verificationStatus}
              </Badge>
            </div>
          </li>
        ))}
        {student.documents.length === 0 && <p className="text-sm text-muted-foreground">No documents on file.</p>}
      </ul>
    </div>
  );
}

function AttendanceSection({ studentId }: { studentId: string }) {
  const { data, loading, error } = useStudentAttendance(studentId);

  if (loading) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading attendance…</p>;
  if (error) return <p className="rounded-lg border border-error/30 bg-error/10 p-sm text-xs text-error">{error}</p>;
  if (!data) return null;

  const s = data.summary;
  const pct = s.attendancePercentage;
  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="rounded-lg border border-border p-sm">
          <p className="text-xs text-muted-foreground">Attendance</p>
          <p className="text-lg font-semibold text-foreground">{pct === null ? "—" : `${pct}%`}</p>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <p className="text-xs text-muted-foreground">Days marked</p>
          <p className="text-lg font-semibold text-foreground">{s.records}</p>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <p className="text-xs text-muted-foreground">Present</p>
          <p className="text-lg font-semibold text-success">{s.present + s.late}</p>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <p className="text-xs text-muted-foreground">Absent</p>
          <p className="text-lg font-semibold text-error">{s.absent}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Recent attendance</h2>
        <ul className="flex flex-col gap-sm">
          {data.recent.map((r, i) => (
            <li key={`${r.date}-${i}`} className="flex items-center justify-between gap-sm border-b border-border pb-sm text-sm last:border-0 last:pb-0">
              <div className="min-w-0">
                <p className="text-foreground">{new Date(r.date).toLocaleDateString("en-IN")}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {r.className} · Section {r.section.name}
                  {r.remarks ? ` · ${r.remarks}` : ""}
                </p>
              </div>
              <Badge tone={attendanceStatusTone[r.status as AttendanceStatus] ?? "neutral"}>
                {attendanceStatusLabels[r.status as AttendanceStatus] ?? r.status}
              </Badge>
            </li>
          ))}
          {data.recent.length === 0 && <p className="text-sm text-muted-foreground">No attendance recorded yet.</p>}
        </ul>
      </div>
    </div>
  );
}

function TimelineSection({ student }: { student: StudentDetailDto }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Timeline</h2>
      <ul className="flex flex-col gap-sm">
        {student.timeline.map((e) => (
          <li key={e.id} className="flex gap-sm border-b border-border pb-sm last:border-0 last:pb-0">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">{e.title}</p>
              {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(e.createdAt).toLocaleString("en-IN")}
                {e.actorName ? ` · ${e.actorName}` : ""}
              </p>
            </div>
          </li>
        ))}
        {student.timeline.length === 0 && <p className="text-sm text-muted-foreground">No timeline events yet.</p>}
      </ul>
    </div>
  );
}
