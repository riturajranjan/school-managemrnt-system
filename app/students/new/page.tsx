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
import { useSisStore } from "@/lib/hooks/use-store";
import {
  studentFormSchema,
  type StudentFormValues,
} from "@/lib/schemas/student-form";
import { isDuplicateAdmissionNumber } from "@/lib/services/students-service";
import { setState } from "@/lib/data/store";
import { generateId } from "@/lib/utils";
import type { Student } from "@/lib/types/students";

export default function NewStudentPage() {
  const router = useRouter();
  const db = useSisStore();
  const [duplicateError, setDuplicateError] = useState<string | null>(null);

  const form = useForm<StudentFormValues>({
    resolver: zodResolver(studentFormSchema),
    defaultValues: {
      gender: "prefer-not-to-say",
      admissionDate: new Date().toISOString().slice(0, 10),
    },
  });

  const classId = form.watch("classId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  function onSubmit(values: StudentFormValues) {
    if (isDuplicateAdmissionNumber(db, values.admissionNumber)) {
      setDuplicateError(
        `Admission number "${values.admissionNumber}" is already in use.`,
      );
      return;
    }
    const now = new Date().toISOString();
    const studentId = generateId("student");
    const guardianId = generateId("guardian");

    const student: Student = {
      id: studentId,
      admissionNumber: values.admissionNumber,
      rollNumber: values.rollNumber || undefined,
      profile: {
        firstName: values.firstName,
        lastName: values.lastName,
        dob: values.dob,
        gender: values.gender,
        nationality: "Indian",
      },
      classId: values.classId,
      sectionId: values.sectionId,
      session: "2026-2027",
      branchId: "main",
      status: "active",
      admissionDate: values.admissionDate,
      admissionType: "new",
      address: {
        line1: "",
        city: "",
        state: "",
        postalCode: "",
        country: "India",
      },
      guardianIds: [guardianId],
      primaryGuardianId: guardianId,
      academics: {
        overallPercent: 0,
        trend: "flat",
        upcomingExams: [],
        recentHomework: [],
        subjectsAtRisk: [],
      },
      attendance: {
        presentPercent: 100,
        presentDays: 0,
        absentDays: 0,
        lateDays: 0,
        totalDays: 0,
        todayStatus: "not-marked",
        trend7Day: [100, 100, 100, 100, 100, 100, 100],
      },
      fees: { status: "pending", totalDue: 0, totalPaid: 0, overdueAmount: 0 },
      health: {
        emergencyContactName: values.guardianFirstName,
        emergencyContactPhone: values.guardianPhone,
        allergies: [],
        conditions: [],
        medications: [],
      },
      behaviourNotes: [],
      pulse: {
        overallScore: 75,
        status: "good",
        positiveTrend: "New enrollment — baseline pulse not yet established",
        mainRisk: "Insufficient data",
        suggestedAction:
          "Pulse will populate as attendance and academic data accrues.",
        explanation:
          "Pulse blends attendance, gradebook, homework, and behaviour records into six weighted dimensions.",
        dimensions: (
          [
            "academics",
            "attendance",
            "engagement",
            "behaviour",
            "homework",
            "wellbeing",
          ] as const
        ).map((key) => ({
          key,
          label: key.charAt(0).toUpperCase() + key.slice(1),
          score: 75,
          tone: "info" as const,
          trend: "flat" as const,
          summary: "New enrollment — establishing baseline",
        })),
      },
      documents: [],
      timeline: [
        {
          id: generateId("evt"),
          subjectId: studentId,
          category: "admission",
          title: "Student record created",
          actorName: "Administrator",
          createdAt: now,
        },
      ],
      createdAt: now,
      updatedAt: now,
    };

    setState((current) => ({
      ...current,
      students: [student, ...current.students],
      guardians: [
        ...current.guardians,
        {
          id: guardianId,
          firstName: values.guardianFirstName,
          lastName: values.guardianLastName,
          contact: {
            phone: values.guardianPhone,
            email: values.guardianEmail || undefined,
          },
          communicationPreference: "sms",
        },
      ],
      studentGuardianLinks: [
        ...current.studentGuardianLinks,
        {
          studentId,
          guardianId,
          relationship: "guardian",
          isPrimary: true,
          isEmergencyContact: true,
          isAuthorizedPickup: true,
          isFeeResponsible: true,
        },
      ],
    }));

    router.push(`/students/${studentId}`);
  }

  return (
    <div className="mx-auto flex  flex-col gap-md">
      <h1 className="text-lg font-semibold text-foreground">Add student</h1>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {duplicateError && (
          <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">
            {duplicateError}
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
            onClick={() => router.push("/students")}>
            Cancel
          </Button>
          <Button type="submit">Create student</Button>
        </div>
      </form>
    </div>
  );
}
