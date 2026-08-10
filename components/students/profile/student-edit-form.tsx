"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { schoolClasses } from "@/lib/data/seed/reference";
import { updateStudentRequest, useStudentDetail } from "@/lib/hooks/api/use-students";
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
  const router = useRouter();
  const { data: student, loading, error } = useStudentDetail(studentId);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Reverse-map the real class/section labels back onto the reference picklist ids.
  const initial = useMemo<EditValues | undefined>(() => {
    if (!student) return undefined;
    const cls = schoolClasses.find((c) => c.name === student.classLabel);
    const section = cls?.sections.find((s) => s.name === student.sectionLabel);
    return {
      firstName: student.firstName,
      lastName: student.lastName,
      rollNumber: student.rollNumber ?? "",
      classId: cls?.id ?? "",
      sectionId: section?.id ?? "",
      status: (student.status as StudentStatus) ?? "active",
      house: student.house ?? "",
    };
  }, [student]);

  const form = useForm<EditValues>({ values: initial });

  const classId = form.watch("classId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  if (loading) return <div className="py-2xl text-center text-sm text-muted-foreground">Loading student…</div>;
  if (error || !student) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">{error ? "Could not load student" : "Student not found"}</p>
        <Button asChild variant="outline">
          <Link href="/students">Back to Students</Link>
        </Button>
      </div>
    );
  }

  async function onSubmit(values: EditValues) {
    setSaveError(null);
    setSaving(true);
    const classLabel = schoolClasses.find((c) => c.id === values.classId)?.name;
    const sectionLabel = sections.find((s) => s.id === values.sectionId)?.name;
    const res = await updateStudentRequest(studentId, {
      firstName: values.firstName,
      lastName: values.lastName,
      rollNumber: values.rollNumber || undefined,
      house: values.house || undefined,
      classLabel,
      sectionLabel,
      status: values.status,
    });
    setSaving(false);
    if (!res.success) {
      setSaveError(res.error.message);
      return;
    }
    router.push(`/students/${studentId}`);
  }

  return (
    <div className="mx-auto flex flex-col gap-md">
      <h1 className="text-lg font-semibold text-foreground">Edit student</h1>
      <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {saveError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{saveError}</p>}
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          <div>
            <Label htmlFor="firstName">First name</Label>
            <Input id="firstName" {...form.register("firstName", { required: true })} />
          </div>
          <div>
            <Label htmlFor="lastName">Last name</Label>
            <Input id="lastName" {...form.register("lastName", { required: true })} />
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
                    {Object.entries(studentStatusLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button type="button" variant="outline" disabled={saving} onClick={() => router.push(`/students/${studentId}`)}>
            Cancel
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}
