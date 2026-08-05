import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { approveApplication, moveApplicationStage, rejectApplication, updateDocumentStatus, waitlistApplication } from "./admissions-service";

function firstApplicationInStage(stage: string) {
  const app = getSnapshot().applications.find((a) => a.stage === stage);
  if (!app) throw new Error(`No seeded application in stage ${stage}`);
  return app;
}

describe("admissions-service stage movement", () => {
  beforeEach(() => resetDemoData());

  it("moves an application to a new stage and records a timeline entry", () => {
    const app = firstApplicationInStage("under-review");
    const timelineCountBefore = app.timeline.length;

    moveApplicationStage(app.id, "interview-scheduled", "Test Officer");

    const updated = getSnapshot().applications.find((a) => a.id === app.id)!;
    expect(updated.stage).toBe("interview-scheduled");
    expect(updated.timeline.length).toBe(timelineCountBefore + 1);
    expect(updated.timeline[0].title).toMatch(/interview scheduled/i);
    expect(updated.timeline[0].actorName).toBe("Test Officer");
  });

  it("approves an application by moving it to the approved stage", () => {
    const app = firstApplicationInStage("interview-scheduled");
    approveApplication(app.id, "Principal");
    const updated = getSnapshot().applications.find((a) => a.id === app.id)!;
    expect(updated.stage).toBe("approved");
  });

  it("rejects an application with a reason recorded on the timeline", () => {
    const app = firstApplicationInStage("under-review");
    rejectApplication(app.id, "Incomplete documentation", "Principal");
    const updated = getSnapshot().applications.find((a) => a.id === app.id)!;
    expect(updated.stage).toBe("rejected");
    expect(updated.timeline[0].detail).toBe("Incomplete documentation");
  });

  it("waitlists an application", () => {
    const app = firstApplicationInStage("interview-scheduled");
    waitlistApplication(app.id, "Admission Officer");
    const updated = getSnapshot().applications.find((a) => a.id === app.id)!;
    expect(updated.stage).toBe("waitlisted");
  });

  it("does not affect other applications when moving one application's stage", () => {
    const app = firstApplicationInStage("under-review");
    const otherApp = getSnapshot().applications.find((a) => a.id !== app.id)!;
    const otherStageBefore = otherApp.stage;

    moveApplicationStage(app.id, "approved", "Test Officer");

    const otherAfter = getSnapshot().applications.find((a) => a.id === otherApp.id)!;
    expect(otherAfter.stage).toBe(otherStageBefore);
  });
});

describe("updateDocumentStatus", () => {
  beforeEach(() => resetDemoData());

  it("approves a document and records who verified it", () => {
    const app = getSnapshot().applications.find((a) => a.documents.length > 0)!;
    const doc = app.documents[0];

    updateDocumentStatus(app.id, doc.id, "approved", { verifiedBy: "Admission Officer" });

    const updatedDoc = getSnapshot().applications.find((a) => a.id === app.id)!.documents.find((d) => d.id === doc.id)!;
    expect(updatedDoc.status).toBe("approved");
    expect(updatedDoc.verifiedBy).toBe("Admission Officer");
    expect(updatedDoc.verifiedAt).toBeDefined();
  });

  it("records a rejection reason when a document is rejected", () => {
    const app = getSnapshot().applications.find((a) => a.documents.length > 0)!;
    const doc = app.documents[0];

    updateDocumentStatus(app.id, doc.id, "rejected", { rejectionReason: "Illegible scan" });

    const updatedDoc = getSnapshot().applications.find((a) => a.id === app.id)!.documents.find((d) => d.id === doc.id)!;
    expect(updatedDoc.status).toBe("rejected");
    expect(updatedDoc.rejectionReason).toBe("Illegible scan");
  });

  it("only changes the targeted document, not sibling documents", () => {
    const app = getSnapshot().applications.find((a) => a.documents.length > 1)!;
    const [target, other] = app.documents;
    const otherStatusBefore = other.status;

    updateDocumentStatus(app.id, target.id, "approved", { verifiedBy: "Admission Officer" });

    const updatedApp = getSnapshot().applications.find((a) => a.id === app.id)!;
    expect(updatedApp.documents.find((d) => d.id === other.id)?.status).toBe(otherStatusBefore);
  });
});
