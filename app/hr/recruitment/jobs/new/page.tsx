"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BriefcaseBusiness } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createJob } from "@/lib/services/hr-service";
import { moneyFromMajor } from "@/lib/finance/money";
import { roleLabels } from "@/lib/permissions/roles";
import { employmentTypeLabels, type EmploymentType } from "@/lib/types/hr";

export default function NewJobPage() {
  const db = useSisStore();
  const router = useRouter();
  const { can, role } = usePermissions();

  const [title, setTitle] = useState("");
  const [departmentId, setDepartmentId] = useState(db.departments[0]?.id ?? "");
  const [employmentType, setEmploymentType] = useState<EmploymentType>("permanent");
  const [openings, setOpenings] = useState("1");
  const [minExp, setMinExp] = useState("2");
  const [salaryMin, setSalaryMin] = useState("30000");
  const [salaryMax, setSalaryMax] = useState("50000");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  if (!can("hr.manageRecruitment")) return <PermissionDenied action="create jobs" role={roleLabels[role]} backHref="/hr/recruitment/jobs" />;

  function submit() {
    setError(null);
    if (!title.trim()) return setError("Job title is required.");
    const r = createJob({
      title: title.trim(),
      departmentId,
      branch: "main",
      employmentType,
      openings: Number(openings) || 1,
      minExperienceYears: Number(minExp) || 0,
      qualification: "As per role",
      skills: [],
      salaryMin: moneyFromMajor(Number(salaryMin) || 0, "INR"),
      salaryMax: moneyFromMajor(Number(salaryMax) || 0, "INR"),
      description: description.trim(),
      responsibilities: [],
      requirements: [],
      deadline: new Date(Date.now() + 21 * 86_400_000).toISOString().slice(0, 10),
    });
    if (r.ok && r.job) router.push(`/hr/recruitment/jobs/${r.job.id}`);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/hr/recruitment/jobs"><ArrowLeft className="size-4" /></Link></Button>
        <h1 className="text-lg font-semibold text-foreground">Create job</h1>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="title">Job title *</Label>
          <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Mathematics Teacher" />
        </div>
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label>Department</Label>
            <Select value={departmentId} onValueChange={setDepartmentId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{db.departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Employment type</Label>
            <Select value={employmentType} onValueChange={(v) => setEmploymentType(v as EmploymentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(Object.keys(employmentTypeLabels) as EmploymentType[]).map((t) => <SelectItem key={t} value={t}>{employmentTypeLabels[t]}</SelectItem>)}</SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-md sm:grid-cols-4">
          <NumberField label="Openings" value={openings} onChange={setOpenings} />
          <NumberField label="Min exp (yrs)" value={minExp} onChange={setMinExp} />
          <NumberField label="Salary min (₹)" value={salaryMin} onChange={setSalaryMin} />
          <NumberField label="Salary max (₹)" value={salaryMax} onChange={setSalaryMax} />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="desc">Description</Label>
          <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short role summary" />
        </div>
        {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
        <div className="flex justify-end gap-xs">
          <Button asChild variant="outline"><Link href="/hr/recruitment/jobs">Cancel</Link></Button>
          <Button onClick={submit}><BriefcaseBusiness className="size-4" /> Create job</Button>
        </div>
      </div>
    </div>
  );
}

function NumberField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <Input type="number" inputMode="numeric" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
