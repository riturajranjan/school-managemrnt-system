"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronLeft, ChevronRight, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useSisStore } from "@/lib/hooks/use-store";
import { createEmployee, updateEmployee } from "@/lib/services/hr-service";
import { employeeFormSchema, employeeFormSteps, type EmployeeFormValues } from "@/lib/schemas/hr-form";
import { employmentTypeLabels, employeeStatusLabels, type Employee, type EmploymentType, type EmployeeStatus } from "@/lib/types/hr";
import { moneyFromMajor, toMajorUnits } from "@/lib/finance/money";

const stepFields: (keyof EmployeeFormValues)[][] = [
  ["firstName", "lastName", "gender", "dob"],
  ["email", "phone", "address"],
  ["departmentId", "designationId", "branch", "employmentType", "status", "joiningDate", "isTeaching"],
  ["reportingManagerId", "grossSalaryMajor", "bankName", "bankAccountMasked"],
  ["emergencyName", "emergencyRelationship", "emergencyPhone", "qualificationDegree", "qualificationInstitution", "qualificationYear"],
  [],
];

export function EmployeeForm({ employee }: { employee?: Employee }) {
  const db = useSisStore();
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null);
  const dirtyRef = useRef(false);

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: employee
      ? {
          firstName: employee.firstName,
          lastName: employee.lastName,
          gender: employee.gender,
          dob: employee.dob,
          email: employee.email,
          phone: employee.phone,
          address: employee.address,
          departmentId: employee.departmentId,
          designationId: employee.designationId,
          branch: employee.branch,
          employmentType: employee.employmentType,
          status: employee.status,
          joiningDate: employee.joiningDate,
          isTeaching: employee.isTeaching,
          reportingManagerId: employee.reportingManagerId ?? "",
          grossSalaryMajor: toMajorUnits(employee.grossSalary),
          bankName: employee.bankName ?? "",
          bankAccountMasked: employee.bankAccountMasked ?? "",
          emergencyName: employee.emergencyContacts[0]?.name ?? "",
          emergencyRelationship: employee.emergencyContacts[0]?.relationship ?? "",
          emergencyPhone: employee.emergencyContacts[0]?.phone ?? "",
          qualificationDegree: employee.qualifications[0]?.degree ?? "",
          qualificationInstitution: employee.qualifications[0]?.institution ?? "",
          qualificationYear: employee.qualifications[0]?.year ? String(employee.qualifications[0].year) : "",
        }
      : { branch: "main", gender: "male", employmentType: "probation", status: "probation", isTeaching: false, grossSalaryMajor: 30000 },
  });

  // Autosave-draft simulation + unsaved-change warning.
  useEffect(() => {
    const sub = form.watch(() => {
      dirtyRef.current = true;
      setDraftSavedAt(null);
      const t = setTimeout(() => {
        dirtyRef.current = true;
        setDraftSavedAt(new Date().toLocaleTimeString());
      }, 800);
      return () => clearTimeout(t);
    });
    return () => sub.unsubscribe();
  }, [form]);

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (dirtyRef.current) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, []);

  const departments = db.departments;
  const designations = db.designations.filter((d) => d.departmentId === form.watch("departmentId"));
  const managers = db.employees.filter((e) => e.id !== employee?.id);

  async function next() {
    const valid = await form.trigger(stepFields[step]);
    if (valid) setStep((s) => Math.min(s + 1, employeeFormSteps.length - 1));
  }

  function onSubmit(values: EmployeeFormValues) {
    dirtyRef.current = false;
    const payload = {
      firstName: values.firstName,
      lastName: values.lastName,
      gender: values.gender,
      dob: values.dob,
      photoColor: employee?.photoColor ?? "#18b0c8",
      email: values.email,
      phone: values.phone,
      address: values.address,
      departmentId: values.departmentId,
      designationId: values.designationId,
      branch: values.branch,
      employmentType: values.employmentType,
      status: values.status,
      joiningDate: values.joiningDate,
      confirmationDate: employee?.confirmationDate,
      teacherId: employee?.teacherId,
      isTeaching: values.isTeaching,
      grossSalary: moneyFromMajor(values.grossSalaryMajor, "INR"),
      bankName: values.bankName,
      bankAccountMasked: values.bankAccountMasked,
      reportingManagerId: values.reportingManagerId || undefined,
      emergencyContacts: values.emergencyName ? [{ name: values.emergencyName, relationship: values.emergencyRelationship ?? "", phone: values.emergencyPhone ?? "" }] : employee?.emergencyContacts ?? [],
      qualifications: values.qualificationDegree ? [{ degree: values.qualificationDegree, institution: values.qualificationInstitution ?? "", year: Number(values.qualificationYear) || new Date().getFullYear() }] : employee?.qualifications ?? [],
      experience: employee?.experience ?? [],
      attendancePercent: employee?.attendancePercent ?? 100,
      leaveBalanceDays: employee?.leaveBalanceDays ?? 0,
    };
    if (employee) {
      updateEmployee(employee.id, payload);
      router.push(`/hr/staff/${employee.id}`);
    } else {
      const result = createEmployee(payload);
      if (result.ok && result.employee) router.push(`/hr/staff/${result.employee.id}`);
    }
  }

  const err = form.formState.errors;

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-md">
      {/* Step indicator */}
      <ol className="flex flex-wrap items-center gap-1 text-xs" aria-label="Form steps">
        {employeeFormSteps.map((s, i) => (
          <li key={s.key} className="flex items-center gap-1">
            <button type="button" onClick={() => i < step && setStep(i)} className={`flex items-center gap-1 rounded-pill px-2 py-1 font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground"}`}>
              {i < step ? <Check className="size-3" /> : <span>{i + 1}</span>} {s.label}
            </button>
            {i < employeeFormSteps.length - 1 && <ChevronRight className="size-3 text-muted-foreground" />}
          </li>
        ))}
      </ol>

      <div className="rounded-lg border border-border bg-surface p-md">
        {step === 0 && (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <FieldWrap label="First name" error={err.firstName?.message}><Input {...form.register("firstName")} /></FieldWrap>
            <FieldWrap label="Last name" error={err.lastName?.message}><Input {...form.register("lastName")} /></FieldWrap>
            <FieldWrap label="Gender">
              <Controller control={form.control} name="gender" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="male">Male</SelectItem><SelectItem value="female">Female</SelectItem><SelectItem value="other">Other</SelectItem></SelectContent></Select>
              )} />
            </FieldWrap>
            <FieldWrap label="Date of birth" error={err.dob?.message}><Input type="date" {...form.register("dob")} /></FieldWrap>
          </div>
        )}

        {step === 1 && (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <FieldWrap label="Email" error={err.email?.message}><Input type="email" {...form.register("email")} /></FieldWrap>
            <FieldWrap label="Phone" error={err.phone?.message}><Input {...form.register("phone")} /></FieldWrap>
            <div className="sm:col-span-2"><FieldWrap label="Address" error={err.address?.message}><Input {...form.register("address")} /></FieldWrap></div>
          </div>
        )}

        {step === 2 && (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <FieldWrap label="Department" error={err.departmentId?.message}>
              <Controller control={form.control} name="departmentId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select>
              )} />
            </FieldWrap>
            <FieldWrap label="Designation" error={err.designationId?.message}>
              <Controller control={form.control} name="designationId" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger><SelectContent>{designations.map((d) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}</SelectContent></Select>
              )} />
            </FieldWrap>
            <FieldWrap label="Employment type">
              <Controller control={form.control} name="employmentType" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(employmentTypeLabels) as EmploymentType[]).map((t) => <SelectItem key={t} value={t}>{employmentTypeLabels[t]}</SelectItem>)}</SelectContent></Select>
              )} />
            </FieldWrap>
            <FieldWrap label="Status">
              <Controller control={form.control} name="status" render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(employeeStatusLabels) as EmployeeStatus[]).map((s) => <SelectItem key={s} value={s}>{employeeStatusLabels[s]}</SelectItem>)}</SelectContent></Select>
              )} />
            </FieldWrap>
            <FieldWrap label="Joining date" error={err.joiningDate?.message}><Input type="date" {...form.register("joiningDate")} /></FieldWrap>
            <label className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <span className="text-sm text-foreground">Teaching staff</span>
              <Controller control={form.control} name="isTeaching" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <FieldWrap label="Reporting manager">
              <Controller control={form.control} name="reportingManagerId" render={({ field }) => (
                <Select value={field.value || ""} onValueChange={field.onChange}><SelectTrigger><SelectValue placeholder="Select manager" /></SelectTrigger><SelectContent>{managers.slice(0, 40).map((m) => <SelectItem key={m.id} value={m.id}>{m.firstName} {m.lastName}</SelectItem>)}</SelectContent></Select>
              )} />
            </FieldWrap>
            <FieldWrap label="Gross salary / month (₹)" error={err.grossSalaryMajor?.message}><Input type="number" inputMode="numeric" {...form.register("grossSalaryMajor", { valueAsNumber: true })} /></FieldWrap>
            <FieldWrap label="Bank name"><Input {...form.register("bankName")} /></FieldWrap>
            <FieldWrap label="Account (masked)"><Input {...form.register("bankAccountMasked")} placeholder="••••1234" /></FieldWrap>
          </div>
        )}

        {step === 4 && (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <FieldWrap label="Emergency contact name"><Input {...form.register("emergencyName")} /></FieldWrap>
            <FieldWrap label="Relationship"><Input {...form.register("emergencyRelationship")} /></FieldWrap>
            <FieldWrap label="Emergency phone"><Input {...form.register("emergencyPhone")} /></FieldWrap>
            <div />
            <FieldWrap label="Highest qualification"><Input {...form.register("qualificationDegree")} /></FieldWrap>
            <FieldWrap label="Institution"><Input {...form.register("qualificationInstitution")} /></FieldWrap>
            <FieldWrap label="Year"><Input type="number" inputMode="numeric" {...form.register("qualificationYear")} placeholder="2018" /></FieldWrap>
          </div>
        )}

        {step === 5 && (
          <div className="flex flex-col gap-sm text-sm">
            <p className="text-muted-foreground">Review the details, then create the employee record. Documents, system access and payroll setup can be completed during onboarding.</p>
            <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
              <ReviewRow label="Name" value={`${form.watch("firstName")} ${form.watch("lastName")}`} />
              <ReviewRow label="Email" value={form.watch("email")} />
              <ReviewRow label="Department" value={departments.find((d) => d.id === form.watch("departmentId"))?.name ?? "—"} />
              <ReviewRow label="Designation" value={designations.find((d) => d.id === form.watch("designationId"))?.title ?? db.designations.find((d) => d.id === form.watch("designationId"))?.title ?? "—"} />
              <ReviewRow label="Type" value={employmentTypeLabels[form.watch("employmentType")]} />
              <ReviewRow label="Joins" value={form.watch("joiningDate")} />
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-sm">
        <span className="text-xs text-muted-foreground">{draftSavedAt ? `Draft saved ${draftSavedAt}` : "Editing…"}</span>
        <div className="flex gap-xs">
          {step > 0 && <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}><ChevronLeft className="size-4" /> Back</Button>}
          {step < employeeFormSteps.length - 1 ? (
            <Button type="button" onClick={next}>Next <ChevronRight className="size-4" /></Button>
          ) : (
            <Button type="submit"><Save className="size-4" /> {employee ? "Save changes" : "Create employee"}</Button>
          )}
        </div>
      </div>
    </form>
  );
}

function FieldWrap({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="truncate font-medium text-foreground">{value}</p>
    </div>
  );
}
