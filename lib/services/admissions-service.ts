import { setState } from "@/lib/data/store";
import type { Db } from "@/lib/data/store";
import type {
  AdmissionApplication,
  AdmissionInterview,
  AdmissionInterviewResult,
  AdmissionStageKey,
} from "@/lib/types/admissions";
import type { DocumentStatus, DocumentType, TimelineEvent } from "@/lib/types/common";
import { generateId } from "@/lib/utils";
import { admissionStageDefinitions } from "@/lib/types/admissions";

function nowIso() {
  return new Date().toISOString();
}

function stageLabel(stage: AdmissionStageKey): string {
  return admissionStageDefinitions.find((s) => s.key === stage)?.label ?? stage;
}

function pushTimeline(app: AdmissionApplication, event: Omit<TimelineEvent, "id" | "subjectId" | "createdAt"> & { createdAt?: string }): AdmissionApplication {
  const entry: TimelineEvent = {
    id: generateId("evt"),
    subjectId: app.id,
    createdAt: event.createdAt ?? nowIso(),
    ...event,
  };
  return { ...app, timeline: [entry, ...app.timeline] };
}

function mapApplication(db: Db, id: string, fn: (app: AdmissionApplication) => AdmissionApplication): Db {
  return {
    ...db,
    applications: db.applications.map((app) => (app.id === id ? { ...fn(app), updatedAt: nowIso() } : app)),
  };
}

export function moveApplicationStage(applicationId: string, stage: AdmissionStageKey, actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated = { ...app, stage, draft: false };
      return pushTimeline(updated, {
        category: "admission",
        title: `Moved to ${stageLabel(stage)}`,
        actorName,
        actorRole: "Staff",
      });
    }),
  );
}

export function bulkMoveApplicationStage(applicationIds: string[], stage: AdmissionStageKey, actorName: string) {
  setState((db) => ({
    ...db,
    applications: db.applications.map((app) =>
      applicationIds.includes(app.id)
        ? pushTimeline({ ...app, stage, updatedAt: nowIso() }, { category: "admission", title: `Moved to ${stageLabel(stage)}`, actorName, actorRole: "Staff" })
        : app,
    ),
  }));
}

export function updateApplication(applicationId: string, patch: Partial<AdmissionApplication>) {
  setState((db) => mapApplication(db, applicationId, (app) => ({ ...app, ...patch })));
}

export function addApplicationNote(applicationId: string, body: string, authorName: string, authorRole: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => ({
      ...app,
      notes: [{ id: generateId("note"), authorName, authorRole, body, createdAt: nowIso() }, ...app.notes],
    })),
  );
}

export function updateDocumentStatus(
  applicationId: string,
  documentId: string,
  status: DocumentStatus,
  extra?: { rejectionReason?: string; verifiedBy?: string },
) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated = {
        ...app,
        documents: app.documents.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                status,
                verifiedAt: status === "approved" ? nowIso() : doc.verifiedAt,
                verifiedBy: status === "approved" ? extra?.verifiedBy ?? doc.verifiedBy : doc.verifiedBy,
                rejectionReason: status === "re-upload-requested" || status === "rejected" ? extra?.rejectionReason : undefined,
              }
            : doc,
        ),
      };
      return pushTimeline(updated, { category: "documents", title: `Document ${status.replace("-", " ")}`, actorName: extra?.verifiedBy ?? "Staff" });
    }),
  );
}

export function uploadDocument(applicationId: string, documentId: string, fileName: string, sizeKb: number, uploadedBy: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated = {
        ...app,
        documents: app.documents.map((doc) =>
          doc.id === documentId
            ? {
                ...doc,
                status: "uploaded" as DocumentStatus,
                fileName,
                sizeKb,
                uploadedAt: nowIso(),
                uploadedBy,
                rejectionReason: undefined,
                versions: [{ id: generateId("ver"), fileName, uploadedAt: nowIso(), uploadedBy, sizeKb }, ...doc.versions],
              }
            : doc,
        ),
      };
      return pushTimeline(updated, { category: "documents", title: "Document uploaded", actorName: uploadedBy });
    }),
  );
}

export function addCustomDocumentRequest(applicationId: string, label: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => ({
      ...app,
      documents: [
        ...app.documents,
        { id: generateId("doc"), ownerId: applicationId, type: "custom" as DocumentType, customLabel: label, status: "missing" as DocumentStatus, versions: [] },
      ],
    })),
  );
}

export function scheduleInterview(applicationId: string, interview: Omit<AdmissionInterview, "id" | "status">, actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated: AdmissionApplication = {
        ...app,
        stage: "interview-scheduled",
        interview: { id: generateId("intv"), status: "scheduled", ...interview },
      };
      return pushTimeline(updated, { category: "admission", title: "Interview scheduled", detail: interview.scheduledAt, actorName });
    }),
  );
}

export function recordInterviewResult(applicationId: string, result: AdmissionInterviewResult, notes: string, actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      if (!app.interview) return app;
      const updated: AdmissionApplication = { ...app, interview: { ...app.interview, status: "completed", result, notes } };
      return pushTimeline(updated, { category: "admission", title: `Interview result recorded: ${result.replace("-", " ")}`, actorName });
    }),
  );
}

export function assignOfficer(applicationId: string, officerId: string, officerName: string, actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated = { ...app, assignedOfficerId: officerId, assignedOfficerName: officerName };
      return pushTimeline(updated, { category: "admission", title: `Assigned to ${officerName}`, actorName });
    }),
  );
}

export function approveApplication(applicationId: string, actorName: string) {
  moveApplicationStage(applicationId, "approved", actorName);
}

export function rejectApplication(applicationId: string, reason: string, actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated: AdmissionApplication = { ...app, stage: "rejected" };
      return pushTimeline(updated, { category: "admission", title: "Application rejected", detail: reason, actorName });
    }),
  );
}

export function waitlistApplication(applicationId: string, actorName: string) {
  moveApplicationStage(applicationId, "waitlisted", actorName);
}

export function recordApplicationPayment(applicationId: string, paymentId: string, method: "upi" | "card" | "cash" | "bank-transfer", actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated: AdmissionApplication = {
        ...app,
        payments: app.payments.map((p) => (p.id === paymentId ? { ...p, status: "paid", paidAt: nowIso(), method } : p)),
        stage: app.stage === "fee-pending" ? "fee-pending" : app.stage,
      };
      return pushTimeline(updated, { category: "fees", title: "Admission fee payment recorded", actorName });
    }),
  );
}

export function createDraftApplication(seed: Partial<AdmissionApplication> & { branchId: string; session: string }): AdmissionApplication {
  const id = generateId("app");
  const draft: AdmissionApplication = {
    id,
    applicationNumber: `ADM-DRAFT-${id.slice(-6).toUpperCase()}`,
    session: seed.session,
    branchId: seed.branchId,
    draft: true,
    stage: "application-started",
    priority: "medium",
    source: seed.source ?? "website",
    appliedClassId: seed.appliedClassId ?? "",
    admissionType: seed.admissionType ?? "new",
    student: seed.student ?? {
      firstName: "",
      lastName: "",
      dob: "",
      gender: "prefer-not-to-say",
      nationality: "Indian",
    },
    guardians: seed.guardians ?? [],
    address: seed.address ?? { line1: "", city: "", state: "", postalCode: "", country: "India" },
    transport: { required: false },
    hostel: { required: false },
    feeDetails: { applicationFeePaid: false },
    documents: [],
    notes: [],
    payments: [],
    timeline: [{ id: generateId("evt"), subjectId: id, category: "admission", title: "Enquiry created", actorName: "Admission Officer", createdAt: nowIso() }],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    formStep: 1,
  };

  setState((db) => ({ ...db, applications: [draft, ...db.applications] }));
  return draft;
}

export function saveApplicationDraft(applicationId: string, patch: Partial<AdmissionApplication>) {
  setState((db) => mapApplication(db, applicationId, (app) => ({ ...app, ...patch })));
}

export function submitApplication(applicationId: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => {
      const updated: AdmissionApplication = { ...app, draft: false, stage: "documents-pending", submittedAt: nowIso(), formStep: 12 };
      return pushTimeline(updated, { category: "admission", title: "Application form submitted", actorName: "Parent portal" });
    }),
  );
}

export function sendApplicationCommunication(applicationId: string, channel: "email" | "sms" | "whatsapp", body: string, actorName: string) {
  setState((db) =>
    mapApplication(db, applicationId, (app) => pushTimeline(app, { category: "communication", title: `Message sent via ${channel}`, detail: body, actorName })),
  );
}

export function generateApplicationNumber(session: string, sequence: number): string {
  return `ADM-${session.split("-")[0]}-${String(1000 + sequence)}`;
}
