"use client";

// Create exam (Phase 8A) — real PostgreSQL/API cutover. Same form shell as
// before; Grading scheme / Result rule / Report card template / notify-on-
// publish are removed rather than fabricated (no real Grading/Result/Report-Card
// foundation exists yet — Phase 8B/8C). Term is now a real ExamTerm.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import { createExamRequest, useExamTerms } from "@/lib/hooks/api/use-exams-api";
import type { ExamType } from "@/lib/api/contracts";

const examTypeOptions: { value: ExamType; label: string }[] = [
  { value: "unit-test", label: "Unit test" },
  { value: "weekly-test", label: "Weekly test" },
  { value: "monthly-test", label: "Monthly test" },
  { value: "midterm", label: "Midterm" },
  { value: "half-yearly", label: "Half-yearly" },
  { value: "annual", label: "Annual" },
  { value: "pre-board", label: "Pre-board" },
  { value: "board", label: "Board examination" },
  { value: "practical", label: "Practical" },
  { value: "oral", label: "Oral" },
  { value: "assignment", label: "Assignment" },
  { value: "project", label: "Project" },
  { value: "internal-assessment", label: "Internal assessment" },
  { value: "custom", label: "Custom" },
];

const formSchema = z
  .object({
    name: z.string().trim().min(1, "Exam name is required"),
    code: z.string().trim().min(1, "Exam code is required").max(20),
    type: z.enum([
      "unit-test",
      "weekly-test",
      "monthly-test",
      "midterm",
      "half-yearly",
      "annual",
      "pre-board",
      "board",
      "practical",
      "oral",
      "assignment",
      "project",
      "internal-assessment",
      "custom",
    ]),
    examTermId: z.string().min(1, "Select a term"),
    description: z.string().trim().optional().or(z.literal("")),
    startsOn: z.string().min(1, "Start date is required"),
    endsOn: z.string().min(1, "End date is required"),
    scope: z.enum(["internal", "external"]),
    mode: z.enum(["online", "offline"]),
  })
  .refine((d) => d.endsOn >= d.startsOn, {
    message: "End date must be on or after the start date",
    path: ["endsOn"],
  });
type FormValues = z.infer<typeof formSchema>;

export default function NewExamPage() {
  const router = useRouter();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: terms } = useExamTerms();
  const [formError, setFormError] = useState("");
  const [busy, setBusy] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { type: "unit-test", scope: "internal", mode: "offline" },
  });

  if (!capabilitiesLoading && !hasServerPermission("exams.view")) {
    return (
      <PermissionDenied
        action="create an exam"
        role={roleLabels[role]}
        backHref="/exams"
      />
    );
  }

  async function onSubmit(values: FormValues) {
    setBusy(true);
    setFormError("");
    const res = await createExamRequest(values);
    setBusy(false);
    if (!res.success) {
      setFormError(res.error.message);
      return;
    }
    router.push(`/exams/${res.data.id}`);
  }

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Create exam</h1>
        <p className="text-xs text-muted-foreground">
          Define a new exam under a term
        </p>
      </div>

      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex  flex-col gap-sm">
        {formError && (
          <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">
            {formError}
          </p>
        )}

        <div>
          <Label htmlFor="exam-name">Exam name</Label>
          <Input
            id="exam-name"
            placeholder="e.g. Half Yearly Examination"
            {...form.register("name")}
          />
          <FieldError>{form.formState.errors.name?.message}</FieldError>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="exam-code">Exam code</Label>
            <Input
              id="exam-code"
              placeholder="e.g. HY-2627"
              {...form.register("code")}
            />
            <FieldError>{form.formState.errors.code?.message}</FieldError>
          </div>
          <div>
            <Label>Exam type</Label>
            <Controller
              control={form.control}
              name="type"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Exam type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {examTypeOptions.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="exam-term">Term</Label>
          <Controller
            control={form.control}
            name="examTermId"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger aria-label="Term" id="exam-term">
                  <SelectValue
                    placeholder={
                      (terms ?? []).length
                        ? "Select term"
                        : "No terms yet — create one first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {(terms ?? []).map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          <FieldError>{form.formState.errors.examTermId?.message}</FieldError>
        </div>

        <div>
          <Label htmlFor="exam-desc">Description</Label>
          <Textarea
            id="exam-desc"
            placeholder="Optional notes visible to staff"
            {...form.register("description")}
          />
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label htmlFor="exam-start">Start date</Label>
            <Input id="exam-start" type="date" {...form.register("startsOn")} />
            <FieldError>{form.formState.errors.startsOn?.message}</FieldError>
          </div>
          <div>
            <Label htmlFor="exam-end">End date</Label>
            <Input id="exam-end" type="date" {...form.register("endsOn")} />
            <FieldError>{form.formState.errors.endsOn?.message}</FieldError>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>Scope</Label>
            <Controller
              control={form.control}
              name="scope"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Scope">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="internal">Internal</SelectItem>
                    <SelectItem value="external">External</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
          <div>
            <Label>Mode</Label>
            <Controller
              control={form.control}
              name="mode"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger aria-label="Mode">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="offline">Offline</SelectItem>
                    <SelectItem value="online">Online</SelectItem>
                  </SelectContent>
                </Select>
              )}
            />
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          Grading scheme, result rules and report card templates arrive with the
          Marks &amp; Results module.
        </p>

        <Button type="submit" disabled={busy} className="self-start">
          Create exam
        </Button>
      </form>
    </div>
  );
}
