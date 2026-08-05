"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, CheckCircle2, IdCard, KeyRound, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { feeStructures, findClass, hostelBlocks, schoolClasses, transportRoutes } from "@/lib/data/seed/reference";
import { enrollmentFormSchema, type EnrollmentFormValues } from "@/lib/schemas/student-form";
import { convertApplicationToStudent } from "@/lib/services/enrollment-service";
import type { AdmissionApplication } from "@/lib/types/admissions";

export function EnrollmentWizard({ application, onClose }: { application: AdmissionApplication; onClose: () => void }) {
  const [result, setResult] = useState<{ studentId: string } | { errors: string[] } | null>(null);
  const appliedClass = findClass(application.appliedClassId);

  const form = useForm<EnrollmentFormValues>({
    resolver: zodResolver(enrollmentFormSchema),
    defaultValues: {
      admissionNumber: `NIS${new Date().getFullYear()}${application.applicationNumber.slice(-4)}`,
      classId: application.appliedClassId,
      sectionId: appliedClass?.sections[0]?.id ?? "",
      rollNumber: "",
      joiningDate: new Date().toISOString().slice(0, 10),
      feeStructureId: feeStructures.find((f) => f.classId === application.appliedClassId)?.id ?? "",
      transportRouteId: application.transport.routeId ?? "",
      hostelBlockId: "",
      createParentPortal: true,
    },
  });

  const classId = form.watch("classId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  function onSubmit(values: EnrollmentFormValues) {
    const outcome = convertApplicationToStudent({ ...values, applicationId: application.id });
    setResult(outcome);
  }

  const success = result && "studentId" in result;

  return (
    <DetailDrawer open onOpenChange={(open) => !open && onClose()} title="Convert to student" description="Enroll this applicant as an active student">
      {success ? (
        <div className="flex flex-col items-center gap-sm py-lg text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Enrollment complete</p>
          <p className="text-xs text-muted-foreground">Student profile, parent portal invite, and welcome communication have been created.</p>
          <div className="mt-sm flex flex-col gap-xs text-left text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <IdCard className="size-3.5" /> ID card generation queued
            </span>
            <span className="flex items-center gap-1">
              <KeyRound className="size-3.5" /> Parent portal credentials sent
            </span>
            <span className="flex items-center gap-1">
              <Sparkles className="size-3.5" /> Welcome message queued
            </span>
          </div>
          <Button asChild className="mt-md">
            <Link href={`/students/${(result as { studentId: string }).studentId}`}>View student profile</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-md">
          {result && "errors" in result && (
            <div className="flex flex-col gap-1 rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">
              <span className="flex items-center gap-1 font-medium">
                <AlertTriangle className="size-3.5" /> Fix the following before enrolling
              </span>
              {result.errors.map((e) => (
                <span key={e}>· {e}</span>
              ))}
            </div>
          )}

          <div>
            <Label htmlFor="admissionNumber">Admission number *</Label>
            <Input id="admissionNumber" {...form.register("admissionNumber")} aria-invalid={!!form.formState.errors.admissionNumber} />
            <FieldError>{form.formState.errors.admissionNumber?.message}</FieldError>
          </div>

          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label>Class *</Label>
              <Controller
                control={form.control}
                name="classId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("sectionId", ""); }}>
                    <SelectTrigger aria-label="Class">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolClasses.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label>Section *</Label>
              <Controller
                control={form.control}
                name="sectionId"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger aria-label="Section">
                      <SelectValue placeholder="Select section" />
                    </SelectTrigger>
                    <SelectContent>
                      {sections.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Section {s.name} ({s.enrolledCount}/{s.capacity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FieldError>{form.formState.errors.sectionId?.message}</FieldError>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-sm">
            <div>
              <Label htmlFor="rollNumber">Roll number *</Label>
              <Input id="rollNumber" {...form.register("rollNumber")} aria-invalid={!!form.formState.errors.rollNumber} />
              <FieldError>{form.formState.errors.rollNumber?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="joiningDate">Joining date *</Label>
              <Input id="joiningDate" type="date" {...form.register("joiningDate")} />
            </div>
          </div>

          <div>
            <Label>Fee structure *</Label>
            <Controller
              control={form.control}
              name="feeStructureId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Fee structure">
                    <SelectValue placeholder="Select fee structure" />
                  </SelectTrigger>
                  <SelectContent>
                    {feeStructures
                      .filter((f) => f.classId === classId)
                      .map((f) => (
                        <SelectItem key={f.id} value={f.id}>
                          {f.name} — ₹{f.totalAmount.toLocaleString("en-IN")}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{form.formState.errors.feeStructureId?.message}</FieldError>
          </div>

          <div>
            <Label>Transport route (optional)</Label>
            <Controller
              control={form.control}
              name="transportRouteId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Transport route">
                    <SelectValue placeholder="No transport" />
                  </SelectTrigger>
                  <SelectContent>
                    {transportRoutes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div>
            <Label>Hostel block (optional)</Label>
            <Controller
              control={form.control}
              name="hostelBlockId"
              render={({ field }) => (
                <Select value={field.value || undefined} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Hostel block">
                    <SelectValue placeholder="No hostel" />
                  </SelectTrigger>
                  <SelectContent>
                    {hostelBlocks.map((h) => (
                      <SelectItem key={h.id} value={h.id}>
                        {h.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>

          <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
            <div>
              <p className="text-sm font-medium text-foreground">Create parent portal access</p>
              <p className="text-xs text-muted-foreground">Sends portal invites to linked guardians</p>
            </div>
            <Controller control={form.control} name="createParentPortal" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </div>

          <Button type="submit">Confirm enrollment</Button>
        </form>
      )}
    </DetailDrawer>
  );
}
