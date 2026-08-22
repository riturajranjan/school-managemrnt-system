"use client";

// Counselling cases (Phase 9S) — real PostgreSQL/API cutover. The old mock's
// flat "appointment" list is replaced by a real Case-centric model: a case
// is the enduring unit (student + referral + status), sessions are activity
// under it, and confidential notes live under a session — never in this
// list. Case metadata (including which student it's for) is NOT itself
// confidential per the domain's privacy model; only session note bodies are.
import { useState } from "react";
import { CalendarClock, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PrivacyNotice } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import {
  assignCounselingCaseRequest,
  closeCounselingCaseRequest,
  createCounselingNoteRequest,
  createCounselingReferralRequest,
  createCounselingSessionRequest,
  useCounselingCases,
  useCounselingSessionNotes,
  useCounselingSessions,
} from "@/lib/hooks/api/use-counseling-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { CounselingCaseDto, CounselingConcernCategoryDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const CONCERN_CATEGORIES = ["academic", "peer_relationships", "behavioral", "family", "emotional_wellbeing", "other"] as const;

export default function CounsellingAppointmentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: cases, reload } = useCounselingCases();
  const [selected, setSelected] = useState<CounselingCaseDto | null>(null);
  const [referring, setReferring] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("counseling.view")) return <PermissionDenied action="view counselling cases" role={roleLabels[role]} backHref="/counselling" />;
  const canManage = hasServerPermission("counseling.manage");
  const canRefer = hasServerPermission("counseling.refer") || canManage;

  const rows = [...cases].sort((a, b) => b.openedAt.localeCompare(a.openedAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-lg font-semibold text-foreground">Counselling cases</h1><p className="text-xs text-muted-foreground">{rows.length} cases</p></div>
        {canRefer && <Button size="sm" onClick={() => setReferring(true)}>Refer a student</Button>}
      </div>
      <PrivacyNotice kind="counselling" />
      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><CalendarClock className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No cases.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((c) => (
            <button key={c.id} onClick={() => setSelected(c)} className="rounded-lg border border-border bg-surface p-sm text-left hover:border-primary/40">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{c.studentName}</p>
                  <p className="truncate text-xs text-muted-foreground">Opened {formatDate(c.openedAt)} · {c.assignedCounselorName ?? "Unassigned"}{c.concernCategory ? ` · ${c.concernCategory.replace("_", " ")}` : ""}</p>
                </div>
                <Badge tone={c.status === "closed" ? "neutral" : c.status === "active" ? "info" : "warning"}>{c.status}</Badge>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{c.sessionCount} session{c.sessionCount === 1 ? "" : "s"} recorded</p>
            </button>
          ))}
        </div>
      )}

      <ReferDrawer open={referring} onOpenChange={setReferring} onDone={() => { setReferring(false); reload(); }} />
      <CaseDrawer caseItem={selected} canManage={canManage} onClose={() => setSelected(null)} onChanged={reload} />
    </div>
  );
}

function ReferDrawer({ open, onOpenChange, onDone }: { open: boolean; onOpenChange: (o: boolean) => void; onDone: () => void }) {
  const { data: students } = useStudentList({ status: ["active"], pageSize: 300 });
  const [query, setQuery] = useState("");
  const [studentId, setStudentId] = useState<string | null>(null);
  const [concernCategory, setConcernCategory] = useState<string>("");
  const [reason, setReason] = useState("");

  const matches = query.trim() ? students.filter((s) => s.fullName.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 6) : [];
  const selected = students.find((s) => s.id === studentId);

  async function submit() {
    if (!studentId) return;
    await createCounselingReferralRequest({ studentId, concernCategory: (concernCategory || undefined) as CounselingConcernCategoryDto | undefined, referralReason: reason || undefined });
    setStudentId(null); setQuery(""); setConcernCategory(""); setReason("");
    onDone();
  }

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Refer a student" description="Opens a new counselling case">
      <div className="flex flex-col gap-md">
        <div className="flex flex-col gap-1.5">
          <Label>Student *</Label>
          {selected ? (
            <div className="flex items-center justify-between rounded-md border border-border p-sm text-sm"><span className="font-medium text-foreground">{selected.fullName}</span><Button size="sm" variant="ghost" onClick={() => { setStudentId(null); setQuery(""); }}>Change</Button></div>
          ) : (
            <>
              <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search student…" />
              {matches.map((s) => <button key={s.id} onClick={() => setStudentId(s.id)} className="rounded-md border border-border p-sm text-left text-sm hover:border-primary/40">{s.fullName}</button>)}
            </>
          )}
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Concern category</Label>
          <Select value={concernCategory} onValueChange={setConcernCategory}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>{CONCERN_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c.replace("_", " ")}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="reason">Reason for referral</Label><Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Factual, non-diagnostic description" /></div>
        <div className="flex justify-end gap-xs"><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={!studentId}>Submit referral</Button></div>
      </div>
    </DetailDrawer>
  );
}

function CaseDrawer({ caseItem, canManage, onClose, onChanged }: { caseItem: CounselingCaseDto | null; canManage: boolean; onClose: () => void; onChanged: () => void }) {
  const { hasServerPermission } = usePermissions();
  const canConfidential = hasServerPermission("counseling.viewConfidential");
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });
  const { data: sessions, reload: reloadSessions } = useCounselingSessions(caseItem?.id ?? "placeholder");
  const [assigning, setAssigning] = useState(false);
  const [counselorId, setCounselorId] = useState("");
  const [addingSession, setAddingSession] = useState(false);
  const [sessionSummary, setSessionSummary] = useState("");
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  if (!caseItem) return null;

  async function assign() {
    if (!counselorId || !caseItem) return;
    await assignCounselingCaseRequest(caseItem.id, { counselorStaffId: counselorId });
    setAssigning(false); setCounselorId("");
    onChanged();
  }
  async function close() {
    if (!caseItem) return;
    await closeCounselingCaseRequest(caseItem.id);
    onChanged();
    onClose();
  }
  async function addSession() {
    if (!caseItem) return;
    await createCounselingSessionRequest(caseItem.id, { summary: sessionSummary || undefined });
    setAddingSession(false); setSessionSummary("");
    reloadSessions();
    onChanged();
  }

  return (
    <DetailDrawer open={caseItem !== null} onOpenChange={(o) => !o && onClose()} title={caseItem.studentName} description={`Case opened ${formatDate(caseItem.openedAt)}`}>
      <div className="flex flex-col gap-md">
        <div className="flex items-center justify-between gap-sm">
          <Badge tone={caseItem.status === "closed" ? "neutral" : caseItem.status === "active" ? "info" : "warning"}>{caseItem.status}</Badge>
          {canManage && caseItem.status !== "closed" && (
            <div className="flex gap-xs">
              <Button size="sm" variant="outline" onClick={() => setAssigning((v) => !v)}>{caseItem.assignedCounselorName ? "Reassign" : "Assign counselor"}</Button>
              <Button size="sm" variant="ghost" onClick={close}>Close case</Button>
            </div>
          )}
        </div>
        {assigning && (
          <div className="flex items-center gap-xs rounded-md border border-border p-sm">
            <Select value={counselorId} onValueChange={setCounselorId}>
              <SelectTrigger className="flex-1"><SelectValue placeholder="Select counselor" /></SelectTrigger>
              <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
            <Button size="sm" onClick={assign} disabled={!counselorId}>Save</Button>
          </div>
        )}
        <div className="grid grid-cols-2 gap-sm text-sm">
          <div><p className="text-xs text-muted-foreground">Counselor</p><p className="text-foreground">{caseItem.assignedCounselorName ?? "Unassigned"}</p></div>
          <div><p className="text-xs text-muted-foreground">Concern category</p><p className="text-foreground">{caseItem.concernCategory?.replace("_", " ") ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Referral source</p><p className="text-foreground">{caseItem.referralSource ?? "—"}</p></div>
          <div><p className="text-xs text-muted-foreground">Follow-up</p><p className="text-foreground">{caseItem.followUpDate ? formatDate(caseItem.followUpDate) : "None set"}</p></div>
        </div>
        {caseItem.referralReason && <div><p className="text-xs text-muted-foreground">Referral reason</p><p className="text-sm text-foreground">{caseItem.referralReason}</p></div>}

        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold text-foreground">Sessions</h3>{canManage && caseItem.status !== "closed" && <Button size="sm" variant="outline" onClick={() => setAddingSession((v) => !v)}>Add session</Button>}</div>
        {addingSession && (
          <div className="flex flex-col gap-2 rounded-md border border-border p-sm">
            <Input value={sessionSummary} onChange={(e) => setSessionSummary(e.target.value)} placeholder="Factual summary (non-confidential)" />
            <div className="flex justify-end gap-xs"><Button size="sm" variant="ghost" onClick={() => setAddingSession(false)}>Cancel</Button><Button size="sm" onClick={addSession}>Save</Button></div>
          </div>
        )}
        {sessions.length === 0 ? <p className="text-sm text-muted-foreground">No sessions recorded.</p> : (
          <div className="flex flex-col gap-xs">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-md border border-border p-sm text-sm">
                <div className="flex items-center justify-between gap-sm">
                  <div className="min-w-0"><p className="truncate text-foreground">{formatDate(s.sessionDate)} · {s.counselorName}</p>{s.summary && <p className="truncate text-xs text-muted-foreground">{s.summary}</p>}</div>
                  <Button size="sm" variant="ghost" onClick={() => setExpandedSession((id) => (id === s.id ? null : s.id))}>{canConfidential ? "Notes" : <span className="flex items-center gap-1"><Lock className="size-3" /> Restricted</span>}</Button>
                </div>
                {expandedSession === s.id && canConfidential && <ConfidentialNotes sessionId={s.id} />}
                {expandedSession === s.id && !canConfidential && <p className="mt-2 text-xs text-muted-foreground">Session notes are confidential and restricted to the assigned counselor.</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </DetailDrawer>
  );
}

function ConfidentialNotes({ sessionId }: { sessionId: string }) {
  const { data: notes, loading, error, reload } = useCounselingSessionNotes(sessionId);
  const [body, setBody] = useState("");

  async function submit() {
    if (!body.trim()) return;
    const res = await createCounselingNoteRequest(sessionId, { body });
    if (res.success) { setBody(""); reload(); }
  }

  if (loading) return <p className="mt-2 text-xs text-muted-foreground">Loading notes…</p>;
  if (error) return <p className="mt-2 text-xs text-muted-foreground">Case not found or not assigned to you.</p>;

  return (
    <div className="mt-2 flex flex-col gap-2 border-t border-border pt-2">
      {notes.length === 0 ? <p className="text-xs text-muted-foreground">No notes yet.</p> : (
        <div className="flex flex-col gap-1">{notes.map((n) => <p key={n.id} className="rounded-md border border-dashed border-warning/40 bg-warning/8 p-sm text-xs text-warning">{n.body}</p>)}</div>
      )}
      <div className="flex gap-xs"><Input value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add a confidential note…" /><Button size="sm" onClick={submit}>Add</Button></div>
    </div>
  );
}
