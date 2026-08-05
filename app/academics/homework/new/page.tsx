"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { schoolClasses } from "@/lib/data/seed/reference";
import { useManagedClasses, useSubjects } from "@/lib/hooks/use-academics";
import { homeworkFormSchema, type HomeworkFormValues } from "@/lib/schemas/academics-form";
import { createHomework, publishHomework } from "@/lib/services/homework-service";

const submissionTypeOptions = ["offline", "text", "file", "image", "link", "quiz", "mixed"] as const;

export default function NewHomeworkPage() {
  const router = useRouter();
  const classes = useManagedClasses();
  const subjects = useSubjects();
  const form = useForm<HomeworkFormValues>({
    resolver: zodResolver(homeworkFormSchema),
    defaultValues: { maxMarks: 10, submissionType: "file", allowLateSubmission: true, requireParentAcknowledgement: false, dueDate: new Date().toISOString().slice(0, 10) },
  });
  const classId = form.watch("classId");
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  function onSubmit(values: HomeworkFormValues, publish: boolean) {
    const created = createHomework({ ...values, teacherId: "teacher-1", assignedDate: new Date().toISOString(), visibility: "section" });
    if (publish) publishHomework(created.id);
    router.push(`/academics/homework/${created.id}`);
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-md">
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
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Class</Label>
            <Controller
              control={form.control}
              name="classId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={(v) => { field.onChange(v); form.setValue("sectionId", ""); }}>
                  <SelectTrigger aria-label="Class">
                    <SelectValue placeholder="Class" />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((c) => (
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
                    <SelectValue placeholder="Section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>
        <div>
          <Label>Subject</Label>
          <Controller
            control={form.control}
            name="subjectId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Subject">
                  <SelectValue placeholder="Subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="hw-due">Due date</Label>
            <Input id="hw-due" type="date" {...form.register("dueDate")} />
          </div>
          <div>
            <Label htmlFor="hw-marks">Max marks</Label>
            <Input id="hw-marks" type="number" {...form.register("maxMarks", { valueAsNumber: true })} />
          </div>
        </div>
        <div>
          <Label htmlFor="hw-instructions">Instructions</Label>
          <Textarea id="hw-instructions" rows={2} {...form.register("instructions")} />
          <FieldError>{form.formState.errors.instructions?.message}</FieldError>
        </div>
        <div>
          <Label>Submission type</Label>
          <Controller
            control={form.control}
            name="submissionType"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Submission type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {submissionTypeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
          <span className="text-sm text-foreground">Allow late submission</span>
          <Controller control={form.control} name="allowLateSubmission" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        </div>
        <div className="flex items-center justify-between rounded-md border border-border px-sm py-sm">
          <span className="text-sm text-foreground">Require parent acknowledgement</span>
          <Controller control={form.control} name="requireParentAcknowledgement" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
        </div>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button type="button" variant="outline" onClick={form.handleSubmit((v) => onSubmit(v, false))}>
            Save draft
          </Button>
          <Button type="button" onClick={form.handleSubmit((v) => onSubmit(v, true))}>
            Publish
          </Button>
        </div>
      </form>
    </div>
  );
}
