"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { schoolClasses } from "@/lib/data/seed/reference";
import {
  studentFormSchema,
  type StudentFormValues,
} from "@/lib/schemas/student-form";
import { createStudentRequest } from "@/lib/hooks/api/use-students";

export default function NewStudentPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      gender: "prefer-not-to-say",
      admissionDate: new Date().toISOString().slice(0, 10),
    },
  });

  const classId = form.watch("classId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  // Real create: POST /api/students. Class/section come from the reference
  // picklist (labels); the server assigns tenant/school/branch/session.
  async function onSubmit(values: StudentFormValues) {
    setSubmitError(null);
    setSubmitting(true);
    const classLabel = schoolClasses.find((c) => c.id === values.classId)?.name;
    const sectionLabel = sections.find((s) => s.id === values.sectionId)?.name;
    const body = {
      admissionNumber: values.admissionNumber,
      rollNumber: values.rollNumber || undefined,
      firstName: values.firstName,
      lastName: values.lastName,
      dateOfBirth: values.dob,
      gender: values.gender,
      admissionDate: values.admissionDate,
      admissionType: "new" as const,
      classLabel,
      sectionLabel,
      guardians: [
        {
          firstName: values.guardianFirstName,
          lastName: values.guardianLastName,
          phone: values.guardianPhone,
          email: values.guardianEmail || undefined,
          relation: "guardian" as const,
          isPrimary: true,
          isEmergencyContact: true,
          authorizedPickup: true,
          isFeeResponsible: true,
        },
      ],
    };
    const res = await createStudentRequest(body);
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(res.error.message);
      return;
    }
    router.push(`/students/${res.data.id}`);
  }

  return (
    <div className="mx-auto flex  flex-col gap-md">
      <h1 className="text-lg font-semibold text-foreground">Add student</h1>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {submitError && (
          <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">
            {submitError}
          </p>
        )}

        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name *</Label>
            <Input
              id="firstName"
              {...form.register("firstName")}
              aria-invalid={!!form.formState.errors.firstName}
            />
            <FieldError>{form.formState.errors.firstName?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="lastName">Last name *</Label>
            <Input
              id="lastName"
              {...form.register("lastName")}
              aria-invalid={!!form.formState.errors.lastName}
            />
            <FieldError>{form.formState.errors.lastName?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="dob">Date of birth *</Label>
            <Input
              id="dob"
              type="date"
              {...form.register("dob")}
              aria-invalid={!!form.formState.errors.dob}
            />
            <FieldError>{form.formState.errors.dob?.message}</FieldError>
          </div>
          <div>
            <Label>Gender *</Label>
            <Controller
              control={form.control}
              name="gender"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">
                      Prefer not to say
                    </SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label htmlFor="admissionNumber">Admission number *</Label>
            <Input
              id="admissionNumber"
              {...form.register("admissionNumber")}
              aria-invalid={!!form.formState.errors.admissionNumber}
            />
            <FieldError>
              {form.formState.errors.admissionNumber?.message}
            </FieldError>
          </div>
          <div>
            <Label htmlFor="rollNumber">Roll number</Label>
            <Input id="rollNumber" {...form.register("rollNumber")} />
          </div>
          <div>
            <Label>Class *</Label>
            <Controller
              control={form.control}
              name="classId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={(v) => {
                    field.onChange(v);
                    form.setValue("sectionId", "");
                  }}>
                  <SelectTrigger
                    aria-label="Class"
                    aria-invalid={!!form.formState.errors.classId}>
                    <SelectValue placeholder="Select class" />
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
            <FieldError>{form.formState.errors.classId?.message}</FieldError>
          </div>
          <div>
            <Label>Section *</Label>
            <Controller
              control={form.control}
              name="sectionId"
              render={({ field }) => (
                <Select
                  value={field.value}
                  onValueChange={field.onChange}
                  disabled={sections.length === 0}>
                  <SelectTrigger
                    aria-label="Section"
                    aria-invalid={!!form.formState.errors.sectionId}>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        Section {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
            <FieldError>{form.formState.errors.sectionId?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="admissionDate">Admission date *</Label>
            <Input
              id="admissionDate"
              type="date"
              {...form.register("admissionDate")}
            />
          </div>
        </div>

        <div className="border-t border-border pt-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">
            Primary guardian
          </h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="guardianFirstName">First name *</Label>
              <Input
                id="guardianFirstName"
                {...form.register("guardianFirstName")}
                aria-invalid={!!form.formState.errors.guardianFirstName}
              />
              <FieldError>
                {form.formState.errors.guardianFirstName?.message}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="guardianLastName">Last name *</Label>
              <Input
                id="guardianLastName"
                {...form.register("guardianLastName")}
                aria-invalid={!!form.formState.errors.guardianLastName}
              />
              <FieldError>
                {form.formState.errors.guardianLastName?.message}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="guardianPhone">Phone *</Label>
              <Input
                id="guardianPhone"
                type="tel"
                {...form.register("guardianPhone")}
                aria-invalid={!!form.formState.errors.guardianPhone}
              />
              <FieldError>
                {form.formState.errors.guardianPhone?.message}
              </FieldError>
            </div>
            <div>
              <Label htmlFor="guardianEmail">Email</Label>
              <Input
                id="guardianEmail"
                type="email"
                {...form.register("guardianEmail")}
                aria-invalid={!!form.formState.errors.guardianEmail}
              />
              <FieldError>
                {form.formState.errors.guardianEmail?.message}
              </FieldError>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => router.push("/students")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating…" : "Create student"}
          </Button>
        </div>
      </form>
    </div>
  );
}
