"use client";

// Recruitment (Production migration, Phase B, HR Sub-batch 4) — real
// PostgreSQL/API cutover. Deliberately simple: Job Opening + Applicant only,
// no Interview/scoring/ATS pipeline engine (those stay mock: /candidates,
// /interviews). hr.view/hr.manage RBAC — no new permission.
//
// A SELECTED applicant is never auto-converted into a Staff/User — "Start
// Onboarding" below is an explicit action that calls the real recruitment→
// onboarding conversion endpoint, which itself reuses the existing Staff
// provisioning service server-side (never a second employee-creation
// system, and never invoked as a side effect of a stage change).
import Link from "next/link";
import { useState } from "react";
import { BriefcaseBusiness, CalendarClock, Plus, UserPlus, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  createJobApplicantRequest,
  createJobOpeningRequest,
  setJobApplicantStageRequest,
  setJobOpeningStatusRequest,
  startOnboardingFromApplicantRequest,
  useJobApplicants,
  useJobOpenings,
} from "@/lib/hooks/api/use-hr-api";
import { useDepartments, useDesignations } from "@/lib/hooks/api/use-hr-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { EmploymentType, JobApplicantDto, JobApplicantStageDto, JobOpeningDto, JobOpeningStatusDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const openingStatusLabels: Record<JobOpeningStatusDto, string> = { draft: "Draft", open: "Open", closed: "Closed", archived: "Archived" };
const openingStatusTone: Record<JobOpeningStatusDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral", open: "success", closed: "warning", archived: "neutral",
};
const OPENING_NEXT_STATUS: Record<JobOpeningStatusDto, JobOpeningStatusDto[]> = {
  draft: ["open", "archived"], open: ["closed", "archived"], closed: ["archived"], archived: [],
};

const stageLabels: Record<JobApplicantStageDto, string> = {
  applied: "Applied", screening: "Screening", interview: "Interview", selected: "Selected", hired: "Hired", rejected: "Rejected", withdrawn: "Withdrawn",
};
const stageTone: Record<JobApplicantStageDto, "success" | "warning" | "error" | "neutral" | "info"> = {
  applied: "neutral", screening: "info", interview: "info", selected: "warning", hired: "success", rejected: "error", withdrawn: "neutral",
};
const STAGE_NEXT: Record<JobApplicantStageDto, JobApplicantStageDto[]> = {
  applied: ["screening", "rejected", "withdrawn"],
  screening: ["interview", "rejected", "withdrawn"],
  interview: ["selected", "rejected", "withdrawn"],
  selected: ["hired", "rejected", "withdrawn"],
  hired: [], rejected: [], withdrawn: [],
};

const empTypeLabels: Record<EmploymentType, string> = { "full-time": "Full time", "part-time": "Part time", contract: "Contract", temporary: "Temporary" };

export default function RecruitmentPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: openings, loading, error, reload } = useJobOpenings();
  const { data: departments } = useDepartments({ status: "active" });
  const { data: designations } = useDesignations({ status: "active" });
  const [createOpen, setCreateOpen] = useState(false);
  const [manageOpening, setManageOpening] = useState<JobOpeningDto | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [employmentType, setEmploymentType] = useState<EmploymentType | "">("");
  const [openingsCount, setOpeningsCount] = useState("1");
  const [description, setDescription] = useState("");
  const [requirements, setRequirements] = useState("");
  const [closingDate, setClosingDate] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const [candidateName, setCandidateName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [applicantError, setApplicantError] = useState<string | null>(null);

  const { data: applicants, reload: reloadApplicants } = useJobApplicants({ jobOpeningId: manageOpening?.id });

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view recruitment" role={roleLabels[role]} backHref="/hr" />;
  }
  const canManage = hasServerPermission("hr.manage");

  const openCount = openings.filter((o) => o.status === "open").reduce((s, o) => s + o.openings, 0);
  const totalApplicants = openings.reduce((s, o) => s + o.applicantCount, 0);

  function resetForm() {
    setTitle(""); setDepartmentId(""); setDesignationId(""); setEmploymentType(""); setOpeningsCount("1");
    setDescription(""); setRequirements(""); setClosingDate(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!title.trim()) return setFormError("Title is required.");
    const res = await createJobOpeningRequest({
      title: title.trim(), departmentId: departmentId || undefined, designationId: designationId || undefined,
      employmentType: employmentType || undefined, openings: openingsCount ? Number(openingsCount) : undefined,
      description: description.trim() || undefined, requirements: requirements.trim() || undefined,
      closingDate: closingDate || undefined,
    });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setCreateOpen(false);
    reload();
  }

  async function transitionOpening(opening: JobOpeningDto, status: JobOpeningStatusDto) {
    setBusyId(opening.id);
    await setJobOpeningStatusRequest(opening.id, status);
    setBusyId(null);
    reload();
  }

  async function addApplicant() {
    if (!manageOpening) return;
    setApplicantError(null);
    if (!candidateName.trim() || !email.trim()) return setApplicantError("Name and email are required.");
    const res = await createJobApplicantRequest({ jobOpeningId: manageOpening.id, candidateName: candidateName.trim(), email: email.trim(), phone: phone.trim() || undefined, source: source.trim() || undefined });
    if (!res.success) return setApplicantError(res.error.message);
    setCandidateName(""); setEmail(""); setPhone(""); setSource("");
    reloadApplicants();
    reload();
  }

  async function transitionApplicant(applicant: JobApplicantDto, stage: JobApplicantStageDto) {
    setBusyId(applicant.id);
    await setJobApplicantStageRequest(applicant.id, stage);
    setBusyId(null);
    reloadApplicants();
  }

  async function startOnboarding(applicant: JobApplicantDto) {
    const employeeCode = window.prompt(`Employee code for ${applicant.candidateName}:`);
    if (!employeeCode?.trim()) return;
    const startDate = new Date().toISOString().slice(0, 10);
    setBusyId(applicant.id);
    const res = await startOnboardingFromApplicantRequest(applicant.id, { employeeCode: employeeCode.trim(), startDate });
    setBusyId(null);
    if (!res.success) return window.alert(res.error.message);
    reloadApplicants();
    reload();
    window.alert(`Onboarding started for ${applicant.candidateName}.`);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Recruitment</h1>
          <p className="text-xs text-muted-foreground">Job openings and applicants</p>
        </div>
        <div className="flex flex-wrap items-center gap-xs">
          <Button asChild size="sm" variant="outline"><Link href="/hr/recruitment/candidates"><Users className="size-3.5" /> Candidates</Link></Button>
          <Button asChild size="sm" variant="outline"><Link href="/hr/recruitment/interviews"><CalendarClock className="size-3.5" /> Interviews</Link></Button>
          {canManage && <Button size="sm" onClick={() => setCreateOpen(true)}><Plus className="size-3.5" /> Create opening</Button>}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Open positions" value={String(openCount)} icon={BriefcaseBusiness} tone={openCount > 0 ? "warning" : "success"} />
        <StatTile label="Openings" value={String(openings.length)} icon={BriefcaseBusiness} tone="neutral" />
        <StatTile label="Applicants" value={String(totalApplicants)} icon={Users} tone="info" />
        <StatTile label="Hired" value={String(0)} icon={Users} tone="success" />
      </div>

      {error && <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">Could not load job openings: {error}</div>}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Job openings</h2>
        {loading && openings.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">Loading job openings…</p>
        ) : openings.length === 0 ? (
          <p className="py-md text-center text-sm text-muted-foreground">No job openings found.</p>
        ) : (
          <div className="flex flex-col gap-sm">
            {openings.map((o) => (
              <div key={o.id} className="flex flex-col gap-sm rounded-md border border-border p-sm sm:flex-row sm:items-center sm:justify-between">
                <button className="min-w-0 text-left" onClick={() => setManageOpening(o)}>
                  <p className="truncate text-sm font-medium text-foreground hover:underline">{o.title}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {o.departmentName ?? "No department"}{o.designationName ? ` · ${o.designationName}` : ""}
                    {o.employmentType ? ` · ${empTypeLabels[o.employmentType]}` : ""} · {o.openings} opening(s) · {o.applicantCount} applicant(s)
                  </p>
                </button>
                <div className="flex items-center gap-xs">
                  <Badge tone={openingStatusTone[o.status]}>{openingStatusLabels[o.status]}</Badge>
                  <Button size="sm" variant="outline" onClick={() => setManageOpening(o)}>Applicants</Button>
                  {canManage && OPENING_NEXT_STATUS[o.status].length > 0 && (
                    <Select value="" onValueChange={(v) => transitionOpening(o, v as JobOpeningStatusDto)}>
                      <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === o.id} aria-label="Change status"><SelectValue placeholder="Change status" /></SelectTrigger>
                      <SelectContent>{OPENING_NEXT_STATUS[o.status].map((s) => <SelectItem key={s} value={s}>{openingStatusLabels[s]}</SelectItem>)}</SelectContent>
                    </Select>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {canManage && (
        <DetailDrawer open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) resetForm(); }} title="Create job opening" description="Post a real job opening">
          <div className="flex flex-col gap-sm">
            <div><Label htmlFor="jo-title">Title</Label><Input id="jo-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Senior Mathematics Teacher" /></div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label>Department (optional)</Label>
                <Select value={departmentId} onValueChange={setDepartmentId}>
                  <SelectTrigger aria-label="Department"><SelectValue placeholder="Select department" /></SelectTrigger>
                  <SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label>Designation (optional)</Label>
                <Select value={designationId} onValueChange={setDesignationId}>
                  <SelectTrigger aria-label="Designation"><SelectValue placeholder="Select designation" /></SelectTrigger>
                  <SelectContent>{designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label>Employment type (optional)</Label>
                <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as EmploymentType)}>
                  <SelectTrigger aria-label="Employment type"><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>{(Object.keys(empTypeLabels) as EmploymentType[]).map((t) => <SelectItem key={t} value={t}>{empTypeLabels[t]}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="jo-openings">Openings</Label><Input id="jo-openings" type="number" min={1} value={openingsCount} onChange={(e) => setOpeningsCount(e.target.value)} /></div>
            </div>
            <div><Label htmlFor="jo-closing">Closing date (optional)</Label><Input id="jo-closing" type="date" value={closingDate} onChange={(e) => setClosingDate(e.target.value)} /></div>
            <div><Label htmlFor="jo-desc">Description (optional)</Label><Textarea id="jo-desc" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
            <div><Label htmlFor="jo-req">Requirements (optional)</Label><Textarea id="jo-req" value={requirements} onChange={(e) => setRequirements(e.target.value)} /></div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Create opening</Button>
          </div>
        </DetailDrawer>
      )}

      <DetailDrawer
        open={Boolean(manageOpening)}
        onOpenChange={(o) => { if (!o) { setManageOpening(null); setCandidateName(""); setEmail(""); setPhone(""); setSource(""); setApplicantError(null); } }}
        title={manageOpening?.title ?? "Job opening"}
        description="Applicants for this job opening"
      >
        {manageOpening && (
          <div className="flex flex-col gap-md">
            {canManage && (
              <div className="flex flex-col gap-sm rounded-md border border-border p-sm">
                <p className="text-xs font-medium text-muted-foreground">Add applicant</p>
                <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Candidate name" />
                <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" type="email" />
                <div className="grid grid-cols-2 gap-sm">
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone (optional)" />
                  <Input value={source} onChange={(e) => setSource(e.target.value)} placeholder="Source (optional)" />
                </div>
                {applicantError && <p className="text-sm text-error">{applicantError}</p>}
                <Button size="sm" onClick={addApplicant}>Add applicant</Button>
              </div>
            )}
            <div className="flex flex-col gap-xs">
              {!applicants || applicants.length === 0 ? (
                <p className="text-sm text-muted-foreground">No applicants yet.</p>
              ) : (
                applicants.map((a) => (
                  <div key={a.id} className="flex flex-col gap-sm rounded-md border border-border p-sm text-sm sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-foreground">{a.candidateName}</p>
                      <p className="truncate text-xs text-muted-foreground">{a.email} · applied {formatDate(a.appliedDate)}</p>
                    </div>
                    <div className="flex items-center gap-xs">
                      <Badge tone={stageTone[a.stage]}>{stageLabels[a.stage]}</Badge>
                      {canManage && a.stage === "selected" && !a.hasOnboarding && (
                        <Button size="sm" variant="outline" disabled={busyId === a.id} onClick={() => startOnboarding(a)}><UserPlus className="size-3.5" /> Start onboarding</Button>
                      )}
                      {canManage && STAGE_NEXT[a.stage].length > 0 && (
                        <Select value="" onValueChange={(v) => transitionApplicant(a, v as JobApplicantStageDto)}>
                          <SelectTrigger className="h-8 w-auto text-xs" disabled={busyId === a.id} aria-label="Change stage"><SelectValue placeholder="Change stage" /></SelectTrigger>
                          <SelectContent>{STAGE_NEXT[a.stage].map((s) => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}</SelectContent>
                        </Select>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
