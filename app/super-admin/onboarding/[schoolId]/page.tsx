"use client";

// Real per-school onboarding wizard (Super Admin SA-3). All state is server-side
// (/api/super-admin/schools/[id]/onboarding); marking steps and completing are
// real API writes. On refresh/login it resumes from the persisted state — no
// localStorage, no fake progress, no setTimeout saves.
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, CheckCircle2, Circle, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePermissions } from "@/components/providers/permissions-provider";
import { completeOnboardingRequest, updateOnboardingRequest, useOnboarding } from "@/lib/hooks/api/use-onboarding";
import type { StatusTone } from "@/lib/types/common";

const statusLabels: Record<string, string> = { "not-started": "Not started", "in-progress": "In progress", completed: "Completed" };
const statusTone: Record<string, StatusTone> = { "not-started": "neutral", "in-progress": "warning", completed: "success" };

export default function SchoolOnboardingWizard({ params }: { params: Promise<{ schoolId: string }> }) {
  const { schoolId } = use(params);
  const { can } = usePermissions();
  const { data, loading, error, reload } = useOnboarding(schoolId);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const canManage = can("platform.onboarding.manage");

  if (loading) return <div className="py-2xl text-center text-sm text-muted-foreground">Loading onboarding…</div>;
  if (error || !data) {
    return (
      <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">
        {error ? `Could not load onboarding: ${error}` : "Onboarding not found."}{" "}
        <Link href="/super-admin/onboarding" className="text-primary">
          Back
        </Link>
      </div>
    );
  }

  const onboarding = data;
  const isComplete = onboarding.status === "completed";
  const allDone = onboarding.completedCount === onboarding.totalSteps;

  async function toggleStep(key: string, done: boolean) {
    if (isComplete) return;
    const next = done ? onboarding.completedSteps.filter((k) => k !== key) : [...onboarding.completedSteps, key];
    setBusy(true);
    setActionError(null);
    const res = await updateOnboardingRequest(schoolId, { completedSteps: next, currentStep: key });
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  async function complete() {
    setBusy(true);
    setActionError(null);
    const res = await completeOnboardingRequest(schoolId);
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/onboarding">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">{onboarding.school.name}</h1>
            <Badge tone={statusTone[onboarding.status] ?? "neutral"}>{statusLabels[onboarding.status] ?? onboarding.status}</Badge>
          </div>
          <p className="truncate text-xs text-muted-foreground">
            {onboarding.school.code} · {onboarding.completedCount}/{onboarding.totalSteps} steps · {onboarding.progress}%
          </p>
        </div>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
        <div className={isComplete ? "h-full rounded-pill bg-success" : "h-full rounded-pill bg-primary"} style={{ width: `${onboarding.progress}%` }} />
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}

      {isComplete && (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-success/30 bg-success/5 p-lg text-center">
          <CheckCircle2 className="size-10 text-success" aria-hidden="true" />
          <p className="text-sm font-semibold text-foreground">Setup complete — the school is now active.</p>
          <Button asChild size="sm" variant="outline">
            <Link href={`/super-admin/schools/${schoolId}`}>Open school</Link>
          </Button>
        </div>
      )}

      <ol className="flex flex-col gap-sm">
        {onboarding.steps.map((step) => {
          const isCurrent = step.key === onboarding.currentStep;
          return (
            <li
              key={step.key}
              className={`flex items-start gap-sm rounded-lg border p-sm ${isCurrent && !isComplete ? "border-primary/50 bg-primary/5" : "border-border bg-surface"}`}
            >
              <button
                type="button"
                aria-label={step.done ? `Mark ${step.label} incomplete` : `Mark ${step.label} complete`}
                disabled={!canManage || busy || isComplete}
                onClick={() => void toggleStep(step.key, step.done)}
                className="mt-0.5 shrink-0 outline-none disabled:opacity-60"
              >
                {step.done ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground" />}
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{step.label}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              {isCurrent && !isComplete && <Badge tone="info">Current</Badge>}
            </li>
          );
        })}
      </ol>

      {!isComplete && canManage && (
        <div className="flex justify-end border-t border-border pt-md">
          <Button disabled={busy || !allDone} onClick={() => void complete()}>
            <Rocket className="size-3.5" /> {allDone ? "Complete & activate school" : `Complete all ${onboarding.totalSteps} steps to activate`}
          </Button>
        </div>
      )}
    </div>
  );
}
