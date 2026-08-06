"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldError, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useGradingSchemes, useReportCardTemplates, useResultRules } from "@/lib/hooks/use-exams";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { createExam, setExamClasses, updateExam } from "@/lib/services/exam-service";
import { examDetailsSchema, type ExamDetailsFormValues } from "@/lib/schemas/exam-form";
import { examTypeLabels, type ExamType } from "@/lib/types/exams";

const steps = ["Exam details", "Classes & sections", "Grading & results", "Review"] as const;
const examTypeOptions = Object.keys(examTypeLabels) as ExamType[];

export default function NewExamPage() {
  const router = useRouter();
  const { can } = usePermissions();
  const classes = useManagedClasses();
  const gradingSchemes = useGradingSchemes();
  const resultRules = useResultRules();
  const reportCardTemplates = useReportCardTemplates();

  const [step, setStep] = useState(0);
  const [examId, setExamId] = useState<string | null>(null);
  const [selectedSections, setSelectedSections] = useState<string[]>([]);
  const [gradingSchemeId, setGradingSchemeId] = useState("");
  const [resultRuleId, setResultRuleId] = useState("");
  const [reportCardTemplateId, setReportCardTemplateId] = useState("");
  const [isDirty, setIsDirty] = useState(false);

  const form = useForm<ExamDetailsFormValues>({
    resolver: zodResolver(examDetailsSchema),
    defaultValues: { type: "unit-test", term: "Term 1", scope: "internal", mode: "offline", notifyOnPublish: true, description: "", resultDate: "" },
  });

  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (isDirty && !examId) e.preventDefault();
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty, examId]);

  const sectionsByClass = useMemo(() => classes.map((c) => ({ classId: c.id, className: c.name, sections: c.sections })), [classes]);

  if (!can("exams.create")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to create exams.</p>;
  }

  async function handleDetailsNext() {
    const valid = await form.trigger();
    if (!valid) return;
    const values = form.getValues();
    const payload = {
      name: values.name,
      code: values.code,
      type: values.type,
      session: CURRENT_SESSION,
      branchId: "main",
      term: values.term,
      description: values.description || undefined,
      startDate: values.startDate,
      endDate: values.endDate,
      resultDate: values.resultDate || undefined,
      scope: values.scope,
      mode: values.mode,
      classIds: selectedSections.length > 0 ? Array.from(new Set(sectionsByClass.filter((c) => c.sections.some((s) => selectedSections.includes(s.id))).map((c) => c.classId))) : [],
      notifyOnPublish: values.notifyOnPublish,
      createdBy: "Examination Controller",
    };
    if (examId) {
      updateExam(examId, payload);
    } else {
      const exam = createExam(payload, { name: "Examination Controller", role: "Examination Controller" });
      setExamId(exam.id);
    }
    setStep(1);
  }

  function handleClassesNext() {
    if (!examId) return;
    const pairs = selectedSections.map((sectionId) => {
      const owner = sectionsByClass.find((c) => c.sections.some((s) => s.id === sectionId))!;
      return { classId: owner.classId, sectionId };
    });
    setExamClasses(examId, pairs);
    updateExam(examId, { classIds: Array.from(new Set(pairs.map((p) => p.classId))) });
    setStep(2);
  }

  function handleGradingNext() {
    if (!examId) return;
    updateExam(examId, {
      gradingSchemeId: gradingSchemeId || undefined,
      resultRuleId: resultRuleId || undefined,
      reportCardTemplateId: reportCardTemplateId || undefined,
    });
    setStep(3);
  }

  function handleFinish() {
    if (!examId) return;
    router.push(`/exams/${examId}`);
  }

  const detailValues = form.watch();

  return (
    <div className="flex flex-col gap-md pb-28 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Create exam</h1>
        <p className="text-xs text-muted-foreground">
          {examId ? "Progress is saved automatically as you move through each step." : "Set up the exam details, then configure subjects and schedule from the exam page."}
        </p>
      </div>

      <ol className="scrollbar-none flex items-center gap-1 overflow-x-auto rounded-lg border border-border bg-surface p-1.5" aria-label="Wizard steps">
        {steps.map((label, index) => (
          <li key={label} className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              disabled={index > step && !examId}
              onClick={() => (index <= step || examId) && setStep(index)}
              className={`flex min-h-9 items-center gap-1.5 rounded-md px-sm text-xs font-medium transition-colors ${
                index === step ? "bg-primary text-primary-foreground" : index < step ? "text-success" : "text-muted-foreground"
              } disabled:opacity-40`}
            >
              {index < step ? <Check className="size-3.5" /> : <span className="flex size-4 items-center justify-center rounded-pill border border-current text-[10px]">{index + 1}</span>}
              {label}
            </button>
            {index < steps.length - 1 && <ChevronRight className="size-3.5 text-muted-foreground" aria-hidden="true" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <form
          onChange={() => setIsDirty(true)}
          onSubmit={(e) => {
            e.preventDefault();
            handleDetailsNext();
          }}
          className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md"
        >
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="exam-name">Exam name</Label>
              <Input id="exam-name" {...form.register("name")} placeholder="e.g. Half Yearly Examination" />
              <FieldError>{form.formState.errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="exam-code">Exam code</Label>
              <Input id="exam-code" {...form.register("code")} placeholder="e.g. HY-2627" />
              <FieldError>{form.formState.errors.code?.message}</FieldError>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
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
                        <SelectItem key={t} value={t}>
                          {examTypeLabels[t]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div>
              <Label htmlFor="exam-term">Term</Label>
              <Input id="exam-term" {...form.register("term")} placeholder="e.g. Term 1" />
              <FieldError>{form.formState.errors.term?.message}</FieldError>
            </div>
          </div>

          <div>
            <Label htmlFor="exam-desc">Description</Label>
            <Textarea id="exam-desc" rows={2} {...form.register("description")} placeholder="Optional notes visible to staff" />
          </div>

          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <div>
              <Label htmlFor="exam-start">Start date</Label>
              <Input id="exam-start" type="date" {...form.register("startDate")} />
              <FieldError>{form.formState.errors.startDate?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="exam-end">End date</Label>
              <Input id="exam-end" type="date" {...form.register("endDate")} />
              <FieldError>{form.formState.errors.endDate?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="exam-result-date">Result date</Label>
              <Input id="exam-result-date" type="date" {...form.register("resultDate")} />
              <FieldError>{form.formState.errors.resultDate?.message}</FieldError>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
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

          <div className="flex items-center justify-between rounded-md border border-border p-sm">
            <div>
              <p className="text-sm font-medium text-foreground">Notify on publish</p>
              <p className="text-xs text-muted-foreground">Send parent/student notifications when results are published</p>
            </div>
            <Controller control={form.control} name="notifyOnPublish" render={({ field }) => <Switch checked={field.value} onCheckedChange={field.onChange} />} />
          </div>

          <Button type="submit" className="self-end">
            Next: Classes &amp; sections
            <ChevronRight className="size-3.5" />
          </Button>
        </form>
      )}

      {step === 1 && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <p className="text-sm font-medium text-foreground">Select participating classes &amp; sections</p>
          <div className="grid max-h-96 grid-cols-1 gap-sm overflow-y-auto sm:grid-cols-2">
            {sectionsByClass.map((c) => (
              <div key={c.classId} className="rounded-md border border-border p-sm">
                <p className="mb-xs text-xs font-semibold text-foreground">{c.className}</p>
                <div className="flex flex-wrap gap-xs">
                  {c.sections.map((s) => (
                    <label key={s.id} className="flex min-h-9 items-center gap-1.5 rounded-md border border-border px-sm text-sm text-foreground">
                      <Checkbox checked={selectedSections.includes(s.id)} onCheckedChange={(checked) => setSelectedSections((prev) => (checked ? [...prev, s.id] : prev.filter((id) => id !== s.id)))} />
                      Section {s.name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(0)}>
              <ChevronLeft className="size-3.5" />
              Back
            </Button>
            <Button type="button" onClick={handleClassesNext} disabled={selectedSections.length === 0}>
              Next: Grading &amp; results
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div>
            <Label>Grading scheme</Label>
            <Select value={gradingSchemeId} onValueChange={setGradingSchemeId}>
              <SelectTrigger aria-label="Grading scheme">
                <SelectValue placeholder="Select a grading scheme" />
              </SelectTrigger>
              <SelectContent>
                {gradingSchemes.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Result rule</Label>
            <Select value={resultRuleId} onValueChange={setResultRuleId}>
              <SelectTrigger aria-label="Result rule">
                <SelectValue placeholder="Select a result rule" />
              </SelectTrigger>
              <SelectContent>
                {resultRules
                  .filter((r) => !gradingSchemeId || r.gradingSchemeId === gradingSchemeId)
                  .map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Report card template</Label>
            <Select value={reportCardTemplateId} onValueChange={setReportCardTemplateId}>
              <SelectTrigger aria-label="Report card template">
                <SelectValue placeholder="Select a template" />
              </SelectTrigger>
              <SelectContent>
                {reportCardTemplates.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(1)}>
              <ChevronLeft className="size-3.5" />
              Back
            </Button>
            <Button type="button" onClick={handleGradingNext}>
              Next: Review
              <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <p className="text-sm font-medium text-foreground">Review</p>
          <div className="grid grid-cols-2 gap-sm text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Exam</p>
              <p className="text-foreground">{detailValues.name} ({detailValues.code})</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Type</p>
              <p className="text-foreground">{examTypeLabels[detailValues.type]}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Dates</p>
              <p className="text-foreground">{detailValues.startDate} – {detailValues.endDate}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Sections</p>
              <p className="text-foreground">{selectedSections.length} selected</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Grading scheme</p>
              <p className="text-foreground">{gradingSchemes.find((s) => s.id === gradingSchemeId)?.name ?? "Not set"}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Result rule</p>
              <p className="text-foreground">{resultRules.find((r) => r.id === resultRuleId)?.name ?? "Not set"}</p>
            </div>
          </div>
          <Badge tone="neutral" className="self-start">
            Status: Draft — configure subjects and schedule next
          </Badge>
          <div className="flex items-center justify-between">
            <Button type="button" variant="ghost" onClick={() => setStep(2)}>
              <ChevronLeft className="size-3.5" />
              Back
            </Button>
            <Button type="button" onClick={handleFinish}>
              <Check className="size-3.5" />
              Go to exam
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
