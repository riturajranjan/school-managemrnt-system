"use client";

// Create homework (Phase 9B) — real PostgreSQL/API cutover. Section/Subject
// pickers are constrained to the actor's own real TeachingAssignment rows
// (GET /api/homework/assignable) — never an arbitrary class/section/subject.
// Max marks / submission type / allow-late / parent-acknowledgement were
// mock-only fields tied to a submission workflow that doesn't exist yet (see
// prisma/schema.prisma's Homework doc comment) and are dropped, not carried
// forward.
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAssignableTeaching, createHomeworkRequest, publishHomeworkRequest } from "@/lib/hooks/api/use-homework-api";

const formSchema = z.object({
  teachingAssignmentId: z.string().min(1, "Select a class/subject"),
  title: z.string().trim().min(1, "Title is required"),
  description: z.string().trim().min(1, "Description is required"),
  instructions: z.string().trim().optional(),
  dueDate: z.string().min(1, "Due date is required"),
});
type FormValues = z.infer<typeof formSchema>;

export default function NewHomeworkPage() {
  const router = useRouter();
  const { data: assignable, loading, error } = useAssignableTeaching();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { dueDate: new Date().toISOString().slice(0, 10) },
  });
  const teachingAssignmentId = form.watch("teachingAssignmentId");
  const chosen = useMemo(() => assignable.find((a) => a.teachingAssignmentId === teachingAssignmentId), [assignable, teachingAssignmentId]);

  async function onSubmit(values: FormValues, publish: boolean) {
    const assignment = assignable.find((a) => a.teachingAssignmentId === values.teachingAssignmentId);
    if (!assignment) return;
    setSaving(true);
    setSaveError(null);
    const res = await createHomeworkRequest({
      sectionId: assignment.section.id, subjectId: assignment.subject.id,
      title: values.title, description: values.description, instructions: values.instructions || undefined,
      dueAt: values.dueDate,
    });
    if (!res.success) {
      setSaveError(res.error.message);
      setSaving(false);
      return;
    }
    if (publish) {
      const pubRes = await publishHomeworkRequest(res.data.id);
      if (!pubRes.success) {
        setSaveError(pubRes.error.message);
        setSaving(false);
        return;
      }
    }
    router.push(`/academics/homework/${res.data.id}`);
  }

  if (loading) return <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>;
  if (error) return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>;
  if (assignable.length === 0) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have any teaching assignments yet — ask your school admin to assign you to a section and subject first.</p>;
  }

  return (
    <div className="mx-auto flex flex-col gap-md">
      <h1 className="text-lg font-semibold text-foreground">Create homework</h1>
      <form className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div>
          <Label htmlFor="hw-title">Title</Label>
          <Input id="hw-title" {...form.register("title")} />
          <FieldError>{form.formState.errors.title?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="hw-desc">Description</Label>
          <Textarea id="hw-desc" rows={2} {...form.register("description")} />
          <FieldError>{form.formState.errors.description?.message}</FieldError>
        </div>
        <div>
          <Label>Class / section / subject</Label>
          <Controller
            control={form.control}
            name="teachingAssignmentId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Class, section and subject">
                  <SelectValue placeholder="Select what you teach" />
                </SelectTrigger>
                <SelectContent>
                  {assignable.map((a) => (
                    <SelectItem key={a.teachingAssignmentId} value={a.teachingAssignmentId}>
                      {a.section.className}-{a.section.name} · {a.subject.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError>{form.formState.errors.teachingAssignmentId?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="hw-due">Due date</Label>
          <Input id="hw-due" type="date" {...form.register("dueDate")} />
          <FieldError>{form.formState.errors.dueDate?.message}</FieldError>
        </div>
        <div>
          <Label htmlFor="hw-instructions">Instructions</Label>
          <Textarea id="hw-instructions" rows={2} {...form.register("instructions")} />
        </div>

        {saveError && <p className="text-sm text-error">{saveError}</p>}

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button type="button" variant="outline" disabled={saving} onClick={form.handleSubmit((v) => onSubmit(v, false))}>
            Save draft
          </Button>
          <Button type="button" disabled={saving} onClick={form.handleSubmit((v) => onSubmit(v, true))}>
            Publish
          </Button>
        </div>
        {chosen && <p className="text-xs text-muted-foreground">Assigning to {chosen.section.className}-{chosen.section.name}, {chosen.subject.name}.</p>}
      </form>
    </div>
  );
}
