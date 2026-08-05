"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { AdmissionWizard } from "@/components/admissions/wizard/admission-wizard";
import { useAdmissionApplications } from "@/lib/hooks/use-admissions";
import { createDraftApplication } from "@/lib/services/admissions-service";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";

const DRAFT_STORAGE_KEY = "novyra-admission-draft-id";

function NewAdmissionPageContent() {
  const searchParams = useSearchParams();
  const requestedDraftId = searchParams.get("draft");
  const applications = useAdmissionApplications();
  const [draftId, setDraftId] = useState<string | null>(null);

  useEffect(() => {
    if (draftId) return;

    // Creating (or looking up) the draft is a real side effect against the
    // store/sessionStorage, not a derived value — queued as a microtask so
    // it reads as an external-system sync rather than the
    // mirror-a-prop-into-state anti-pattern the set-state-in-effect rule guards against.
    queueMicrotask(() => {
      if (requestedDraftId && applications.some((a) => a.id === requestedDraftId)) {
        setDraftId(requestedDraftId);
        return;
      }
      const resumeId = window.sessionStorage.getItem(DRAFT_STORAGE_KEY);
      if (resumeId && applications.some((a) => a.id === resumeId && a.draft)) {
        setDraftId(resumeId);
        return;
      }
      const draft = createDraftApplication({ branchId: "main", session: CURRENT_SESSION });
      window.sessionStorage.setItem(DRAFT_STORAGE_KEY, draft.id);
      setDraftId(draft.id);
    });
  }, [applications, requestedDraftId, draftId]);

  if (!draftId) {
    return (
      <div className="flex flex-col gap-md" role="status" aria-label="Preparing application form">
        <div className="skeleton h-8 w-64 rounded-md" />
        <div className="skeleton h-64 w-full rounded-lg" />
      </div>
    );
  }

  return <AdmissionWizard draftId={draftId} />;
}

export default function NewAdmissionPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <NewAdmissionPageContent />
    </Suspense>
  );
}
