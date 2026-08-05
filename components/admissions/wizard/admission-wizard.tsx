"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { useAdmissionApplication } from "@/lib/hooks/use-admissions";
import { admissionFormSchema, admissionSteps, type AdmissionFormValues } from "@/lib/schemas/admission-form";
import { saveApplicationDraft, submitApplication } from "@/lib/services/admissions-service";
import { cn } from "@/lib/utils";
import { applicationToFormValues, formValuesToApplicationPatch } from "./form-mapping";
import { stepFieldNames } from "./step-fields";
import { StudentDetailsStep } from "./steps/student-details-step";
import { GuardiansStep } from "./steps/guardians-step";
import { AddressStep } from "./steps/address-step";
import { PreviousSchoolStep } from "./steps/previous-school-step";
import { AcademicDetailsStep } from "./steps/academic-details-step";
import { MedicalInfoStep } from "./steps/medical-info-step";
import { TransportStep } from "./steps/transport-step";
import { HostelStep } from "./steps/hostel-step";
import { DocumentsStep } from "./steps/documents-step";
import { InterviewStep } from "./steps/interview-step";
import { FeeStep } from "./steps/fee-step";
import { ReviewStep } from "./steps/review-step";

const stepComponents = [
  StudentDetailsStep,
  GuardiansStep,
  AddressStep,
  PreviousSchoolStep,
  AcademicDetailsStep,
  MedicalInfoStep,
  TransportStep,
  HostelStep,
  DocumentsStep,
  InterviewStep,
  FeeStep,
  ReviewStep,
];

export function AdmissionWizard({ draftId }: { draftId: string }) {
  const application = useAdmissionApplication(draftId);
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [stepIndex, setStepIndex] = useState(() => Math.min(Math.max((application?.formStep ?? 1) - 1, 0), admissionSteps.length - 1));
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const form = useForm<AdmissionFormValues>({
    resolver: zodResolver(admissionFormSchema),
    defaultValues: application ? applicationToFormValues(application) : undefined,
    mode: "onBlur",
  });

  // Autosave: debounced write-through to the draft record on every change,
  // so "Save & continue later" is just "close the tab" — there's no separate
  // explicit-save path to forget to click.
  useEffect(() => {
    const subscription = form.watch((values) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(() => {
        saveApplicationDraft(draftId, { ...formValuesToApplicationPatch(values as AdmissionFormValues), formStep: stepIndex + 1 });
        setSavedAt(new Date());
      }, 600);
    });
    return () => {
      subscription.unsubscribe();
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [form, draftId, stepIndex]);

  // Unsaved-change protection for hard navigation (tab close / refresh) —
  // in-app "Exit" still routes through handleExit(), which flushes the save first.
  useEffect(() => {
    function handler(e: BeforeUnloadEvent) {
      if (form.formState.isDirty) {
        e.preventDefault();
      }
    }
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [form.formState.isDirty]);

  if (!application) return null;

  const StepComponent = stepComponents[stepIndex];
  const currentStepKey = admissionSteps[stepIndex].key;
  const isLastStep = stepIndex === admissionSteps.length - 1;

  async function goNext() {
    const fields = stepFieldNames[currentStepKey];
    const valid = fields.length === 0 || (await form.trigger(fields));
    if (!valid) return;
    if (isLastStep) return;
    setStepIndex((i) => Math.min(i + 1, admissionSteps.length - 1));
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
    window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
  }

  function handleExit() {
    saveApplicationDraft(draftId, { ...formValuesToApplicationPatch(form.getValues()), formStep: stepIndex + 1 });
    router.push("/admissions");
  }

  async function handleSubmit() {
    const valid = await form.trigger();
    if (!valid) {
      const firstErrorStep = admissionSteps.findIndex((step) => stepFieldNames[step.key].some((name) => name in form.formState.errors));
      if (firstErrorStep >= 0) setStepIndex(firstErrorStep);
      return;
    }
    saveApplicationDraft(draftId, formValuesToApplicationPatch(form.getValues()));
    submitApplication(draftId);
    router.push(`/admissions/${draftId}`);
  }

  return (
    <FormProvider {...form}>
      <div className="flex flex-col gap-md pb-24 sm:pb-0">
        <div className="flex flex-wrap items-center justify-between gap-sm">
          <div>
            <h1 className="text-lg font-semibold text-foreground">New admission application</h1>
            <p className="text-xs text-muted-foreground">
              {application.applicationNumber} {savedAt && <span>· Draft saved {savedAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</span>}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={handleExit}>
            Save &amp; continue later
          </Button>
        </div>

        <WizardProgress stepIndex={stepIndex} onStepClick={setStepIndex} />

        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (isLastStep) void handleSubmit();
            else void goNext();
          }}
          className="rounded-lg border border-border bg-surface p-md sm:p-lg"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStepKey}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -12 }}
              transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
            >
              <h2 className="mb-md text-sm font-semibold text-foreground">{admissionSteps[stepIndex].label}</h2>
              <StepComponent application={application} goToStep={setStepIndex} />
            </motion.div>
          </AnimatePresence>

          <div className="mt-lg flex items-center justify-between gap-sm border-t border-border pt-md">
            <Button type="button" variant="outline" onClick={goBack} disabled={stepIndex === 0}>
              Back
            </Button>
            <Button type="submit">{isLastStep ? "Submit application" : "Next"}</Button>
          </div>
        </form>
      </div>
    </FormProvider>
  );
}

function WizardProgress({ stepIndex, onStepClick }: { stepIndex: number; onStepClick: (index: number) => void }) {
  return (
    <div className="flex flex-col gap-xs">
      <div className="scrollbar-none flex gap-1 overflow-x-auto">
        {admissionSteps.map((step, index) => {
          const state = index < stepIndex ? "done" : index === stepIndex ? "current" : "upcoming";
          return (
            <button
              key={step.key}
              type="button"
              onClick={() => onStepClick(index)}
              className={cn(
                "flex h-1.5 min-w-8 flex-1 items-center justify-center rounded-pill transition-colors",
                state === "done" && "bg-success",
                state === "current" && "bg-primary",
                state === "upcoming" && "bg-surface-secondary",
              )}
              aria-current={state === "current" ? "step" : undefined}
              aria-label={`${step.label} — ${state}`}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-xs text-xs text-muted-foreground">
        <span className="flex size-4 items-center justify-center rounded-pill bg-primary text-[10px] font-semibold text-primary-foreground">
          {stepIndex < admissionSteps.length - 1 ? stepIndex + 1 : <Check className="size-2.5" />}
        </span>
        Step {stepIndex + 1} of {admissionSteps.length} · {admissionSteps[stepIndex].label}
      </div>
    </div>
  );
}
