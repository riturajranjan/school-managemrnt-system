"use client";

// Admission application workspace — Phase 4 real data. Reads GET /api/admissions/[id]
// and drives stage changes, notes and conversion through the real APIs. Interview
// and communication tabs (future/unbacked) are intentionally omitted.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowRight, CheckCircle2, GraduationCap, Mail, Phone, UserX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { stageTone } from "@/components/admissions/stage-meta";
import {
  addNoteRequest,
  changeStageRequest,
  convertApplicationRequest,
  useAdmissionDetail,
} from "@/lib/hooks/api/use-admissions";
import type { AdmissionDetailDto } from "@/lib/api/contracts";
import { admissionStageDefinitions, type AdmissionStageKey } from "@/lib/types/admissions";

const MOVABLE_STAGES = admissionStageDefinitions.filter((s) => s.key !== "enrolled");
const CONVERTIBLE = new Set(["approved", "fee-pending"]);

export function ApplicantWorkspace({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const { can, hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: app, loading, error, reload } = useAdmissionDetail(applicationId);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("admissions.view")) {
    return <PermissionDenied action="view this admission application" role={roleLabels[role]} backHref="/admissions" />;
  }

  if (loading) return <div className="py-2xl text-center text-sm text-muted-foreground">Loading application…</div>;
  if (error || !app) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ? "Could not load application" : "Application not found"}</p>
        {error && <p className="text-xs text-muted-foreground">{error}</p>}
        <Button asChild variant="outline">
          <Link href="/admissions">Back to Admissions</Link>
        </Button>
      </div>
    );
  }

  async function move(stage: AdmissionStageKey, reason?: string) {
    setActionError(null);
    setBusy(true);
    const res = await changeStageRequest(applicationId, stage, reason);
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  async function convert() {
    setActionError(null);
    setBusy(true);
    const res = await convertApplicationRequest(applicationId);
    setBusy(false);
    if (!res.success) {
      setActionError(res.error.message);
      return;
    }
    router.push(`/students/${res.data.studentId}`);
  }

  const canEdit = can("admissions.edit");
  const isEnrolled = app.stage === "enrolled";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <Header app={app} />

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}

      {canEdit && !isEnrolled && (
        <div className="flex flex-wrap items-center gap-sm rounded-lg border border-border bg-surface p-sm">
          <StageMover currentStage={app.stage} busy={busy} onMove={move} />
          <div className="ml-auto flex flex-wrap gap-xs">
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void move("approved")}>
              <CheckCircle2 className="size-3.5" /> Approve
            </Button>
            <Button size="sm" variant="outline" className="text-error" disabled={busy} onClick={() => void move("rejected", "Rejected from workspace")}>
              <UserX className="size-3.5" /> Reject
            </Button>
            {CONVERTIBLE.has(app.stage) && (
              <Button size="sm" disabled={busy} onClick={() => void convert()}>
                <GraduationCap className="size-3.5" /> Convert to student
              </Button>
            )}
          </div>
        </div>
      )}

      {isEnrolled && app.convertedStudentId && (
        <div className="flex items-center justify-between gap-sm rounded-lg border border-success/30 bg-success/5 p-sm text-sm">
          <span className="text-foreground">This application has been enrolled.</span>
          <Button asChild size="sm" variant="outline">
            <Link href={`/students/${app.convertedStudentId}`}>Open student</Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="guardians">Guardians</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="notes">Notes</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <OverviewTab app={app} />
        </TabsContent>
        <TabsContent value="guardians" className="mt-md">
          <GuardiansTab app={app} />
        </TabsContent>
        <TabsContent value="documents" className="mt-md">
          <DocumentsTab app={app} />
        </TabsContent>
        <TabsContent value="notes" className="mt-md">
          <NotesTab app={app} canEdit={canEdit} onAdded={reload} />
        </TabsContent>
        <TabsContent value="history" className="mt-md">
          <HistoryTab app={app} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Header({ app }: { app: AdmissionDetailDto }) {
  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
      <div className="flex items-start gap-sm">
        <Avatar className="size-12">
          <AvatarFallback>{app.applicantName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <div className="flex flex-wrap items-center gap-xs">
            <h1 className="text-base font-semibold text-foreground">{app.applicantName}</h1>
            <Badge tone={stageTone[app.stage as AdmissionStageKey] ?? "neutral"}>{app.stage.replace(/-/g, " ")}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {app.applicationNumber}
            {app.appliedClass ? ` · ${app.appliedClass}` : ""} · {app.source.replace(/-/g, " ")}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-sm gap-y-1 text-xs text-muted-foreground">
            {app.phone && (
              <span className="inline-flex items-center gap-1">
                <Phone className="size-3" /> {app.phone}
              </span>
            )}
            {app.email && (
              <span className="inline-flex items-center gap-1">
                <Mail className="size-3" /> {app.email}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageMover({ currentStage, busy, onMove }: { currentStage: string; busy: boolean; onMove: (s: AdmissionStageKey, reason?: string) => void }) {
  const [stage, setStage] = useState<string>(currentStage);
  const [reason, setReason] = useState("");
  return (
    <div className="flex flex-wrap items-center gap-xs">
      <Select value={stage} onValueChange={setStage}>
        <SelectTrigger className="w-48" aria-label="Move to stage">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MOVABLE_STAGES.map((s) => (
            <SelectItem key={s.key} value={s.key}>
              {s.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input placeholder="Reason (optional)" value={reason} onChange={(e) => setReason(e.target.value)} className="w-48" />
      <Button size="sm" variant="outline" disabled={busy || stage === currentStage} onClick={() => onMove(stage as AdmissionStageKey, reason || undefined)}>
        <ArrowRight className="size-3.5" /> Move
      </Button>
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

function OverviewTab({ app }: { app: AdmissionDetailDto }) {
  const a = app.address;
  const addr = [a.line1, a.line2, a.city, a.state, a.postalCode, a.country].filter(Boolean).join(", ");
  return (
    <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Applicant</h2>
        <div className="grid grid-cols-2 gap-sm">
          <Field label="First name" value={app.firstName} />
          <Field label="Last name" value={app.lastName} />
          <Field label="Gender" value={app.gender.replace(/-/g, " ")} />
          <Field label="Date of birth" value={app.dateOfBirth ? new Date(app.dateOfBirth).toLocaleDateString("en-IN") : "—"} />
          <Field label="Applied class" value={app.appliedClass} />
          <Field label="Section preference" value={app.appliedSectionPreference} />
          <Field label="Admission type" value={app.admissionType.replace(/-/g, " ")} />
          <Field label="Priority" value={app.priority} />
        </div>
      </div>
      <div className="rounded-lg border border-border p-sm">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Application</h2>
        <div className="grid grid-cols-2 gap-sm">
          <Field label="Source" value={app.source.replace(/-/g, " ")} />
          <Field label="Assigned officer" value={app.assignedOfficerName} />
          <Field label="Submitted" value={app.submittedAt ? new Date(app.submittedAt).toLocaleDateString("en-IN") : "—"} />
          <Field label="Approved" value={app.approvedAt ? new Date(app.approvedAt).toLocaleDateString("en-IN") : "—"} />
        </div>
        <div className="mt-sm">
          <Field label="Address" value={addr} />
        </div>
      </div>
    </div>
  );
}

function GuardiansTab({ app }: { app: AdmissionDetailDto }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Guardians (applicant snapshot)</h2>
      <ul className="flex flex-col gap-sm">
        {app.guardians.map((g, i) => (
          <li key={i} className="flex items-center justify-between gap-sm text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium text-foreground">
                {[g.firstName, g.lastName].filter(Boolean).join(" ") || "—"}
                {g.isPrimary && <Badge tone="info" className="ml-xs">Primary</Badge>}
              </p>
              <p className="text-xs text-muted-foreground">
                {g.relation ?? "guardian"}
                {g.phone ? ` · ${g.phone}` : ""}
                {g.email ? ` · ${g.email}` : ""}
              </p>
            </div>
          </li>
        ))}
        {app.guardians.length === 0 && <p className="text-sm text-muted-foreground">No guardian details captured.</p>}
      </ul>
      <p className="mt-sm text-xs text-muted-foreground">Real Guardian records are created and linked when the application is converted to a student.</p>
    </div>
  );
}

function DocumentsTab({ app }: { app: AdmissionDetailDto }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Documents</h2>
      <ul className="flex flex-col gap-sm">
        {app.documents.map((d) => (
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
        {app.documents.length === 0 && <p className="text-sm text-muted-foreground">No documents on file.</p>}
      </ul>
    </div>
  );
}

function NotesTab({ app, canEdit, onAdded }: { app: AdmissionDetailDto; canEdit: boolean; onAdded: () => void }) {
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function add() {
    if (!body.trim()) return;
    setBusy(true);
    setErr(null);
    const res = await addNoteRequest(app.id, body.trim());
    setBusy(false);
    if (!res.success) {
      setErr(res.error.message);
      return;
    }
    setBody("");
    onAdded();
  }

  return (
    <div className="rounded-lg border border-border p-sm">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Notes</h2>
      {canEdit && (
        <div className="mb-sm flex gap-xs">
          <Input placeholder="Add a note…" value={body} onChange={(e) => setBody(e.target.value)} />
          <Button size="sm" disabled={busy || !body.trim()} onClick={() => void add()}>
            Add
          </Button>
        </div>
      )}
      {err && <p className="mb-sm text-xs text-error">{err}</p>}
      <ul className="flex flex-col gap-sm">
        {app.notes.map((n) => (
          <li key={n.id} className="border-b border-border pb-sm last:border-0 last:pb-0">
            <p className="text-sm text-foreground">{n.body}</p>
            <p className="text-xs text-muted-foreground">
              {n.authorName}
              {n.authorRole ? ` · ${n.authorRole}` : ""} · {new Date(n.createdAt).toLocaleString("en-IN")}
            </p>
          </li>
        ))}
        {app.notes.length === 0 && <p className="text-sm text-muted-foreground">No notes yet.</p>}
      </ul>
    </div>
  );
}

function HistoryTab({ app }: { app: AdmissionDetailDto }) {
  return (
    <div className="rounded-lg border border-border p-sm">
      <h2 className="mb-sm text-sm font-semibold text-foreground">Stage history</h2>
      <ul className="flex flex-col gap-sm">
        {app.stageHistory.map((h) => (
          <li key={h.id} className="flex gap-sm border-b border-border pb-sm last:border-0 last:pb-0">
            <div className="mt-1 size-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-foreground">
                {h.fromStage ? `${h.fromStage.replace(/-/g, " ")} → ` : ""}
                {h.toStage.replace(/-/g, " ")}
              </p>
              {h.reason && <p className="text-xs text-muted-foreground">{h.reason}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date(h.createdAt).toLocaleString("en-IN")}
                {h.changedByName ? ` · ${h.changedByName}` : ""}
              </p>
            </div>
          </li>
        ))}
        {app.stageHistory.length === 0 && <p className="text-sm text-muted-foreground">No history yet.</p>}
      </ul>
    </div>
  );
}
