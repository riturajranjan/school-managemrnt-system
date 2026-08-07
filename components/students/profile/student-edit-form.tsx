"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { schoolClasses } from "@/lib/data/seed/reference";
import { useStudent } from "@/lib/hooks/use-students";
import { updateStudent } from "@/lib/services/students-service";
import type { StudentStatus } from "@/lib/types/students";
import { studentStatusLabels } from "@/lib/types/students";

type EditValues = {
  firstName: string;
  lastName: string;
  rollNumber: string;
  classId: string;
  sectionId: string;
  status: StudentStatus;
  house: string;
};

export function StudentEditForm({ studentId }: { studentId: string }) {
  const student = useStudent(studentId);
  const router = useRouter();
  const [saved, setSaved] = useState(false);

  const form = useForm<EditValues>({
    values: student
      ? {
          firstName: student.profile.firstName,
          lastName: student.profile.lastName,
          rollNumber: student.rollNumber ?? "",
          classId: student.classId,
          sectionId: student.sectionId,
          status: student.status,
          house: student.profile.house ?? "",
        }
      : undefined,
  });

  if (!student) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Student not found</p>
        <Button asChild variant="outline">
          <Link href="/students">Back to Students</Link>
        </Button>
      </div>
    );
  }

  const classId = form.watch("classId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  function onSubmit(values: EditValues) {
    updateStudent(studentId, {
      profile: {
        ...student!.profile,
        firstName: values.firstName,
        lastName: values.lastName,
        house: values.house || undefined,
      },
      rollNumber: values.rollNumber || undefined,
      classId: values.classId,
      sectionId: values.sectionId,
      status: values.status,
    });
    setSaved(true);
    setTimeout(() => router.push(`/students/${studentId}`), 500);
  }

  return (
    <div className="mx-auto flex  flex-col gap-md">
      <h1 className="text-lg font-semibold text-foreground">Edit student</h1>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {saved && (
          <p className="rounded-md border border-success/30 bg-success/10 p-sm text-xs text-success">
            Saved — redirecting…
          </p>
        )}
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              {...form.register("firstName", { required: true })}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              {...form.register("lastName", { required: true })}
            />
          </div>
          <div>
            <Label htmlFor="rollNumber">Roll number</Label>
            <Input id="rollNumber" {...form.register("rollNumber")} />
          </div>
          <div>
            <Label htmlFor="house">House</Label>
            <Input id="house" {...form.register("house")} />
          </div>
          <div>
            <Label>Class</Label>
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
            <Label>Section</Label>
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
                        Section {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Controller
              control={form.control}
              name="status"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(studentStatusLabels).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(`/students/${studentId}`)}>
            Cancel
          </Button>
          <Button type="submit">Save changes</Button>
        </div>
      </form>
    </div>
  );
}
