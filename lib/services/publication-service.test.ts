import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { computePublicationChecklist, publishResults, revokePublication } from "./publication-service";

const ACTOR = { name: "Principal", role: "Principal" };

describe("publication-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("shows every checklist item complete for the fully-processed published exam", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const checklist = computePublicationChecklist(db, publishedExam.id);
    const approvalItem = checklist.find((c) => c.key === "approval");
    // "approval" here means "not already published" — since it already IS published in the seed, this one item is expected false.
    expect(checklist.filter((c) => c.key !== "approval").every((c) => c.done)).toBe(true);
    expect(approvalItem?.done).toBe(false);
  });

  it("flags incomplete items for an exam still mid-verification", () => {
    const db = getSnapshot();
    const halfYearly = db.exams.find((e) => e.status === "verification");
    if (!halfYearly) return;
    const checklist = computePublicationChecklist(db, halfYearly.id);
    expect(checklist.some((c) => !c.done)).toBe(true);
  });

  it("publishing sets the exam status to published and creates a publication record", () => {
    const db = getSnapshot();
    const resultReady = db.exams.find((e) => e.status === "result-ready") ?? db.exams.find((e) => e.status === "published");
    if (!resultReady) return;

    const publication = publishResults(resultReady.id, "all", {}, ["parent-portal", "student-portal"], ACTOR);
    expect(publication.status).toBe("published");

    const after = getSnapshot();
    expect(after.exams.find((e) => e.id === resultReady.id)?.status).toBe("published");
    expect(after.resultPublications.some((p) => p.id === publication.id && p.status === "published")).toBe(true);
  });

  it("scheduling a future publication date sets status to scheduled, not published", () => {
    const db = getSnapshot();
    const anyExam = db.exams.find((e) => e.gradingSchemeId);
    if (!anyExam) return;
    const farFuture = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
    const publication = publishResults(anyExam.id, "all", {}, ["email"], ACTOR, farFuture);
    expect(publication.status).toBe("scheduled");
  });

  it("revoking a publication reverts the exam status and marks the publication revoked", () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const publication = db.resultPublications.find((p) => p.examId === publishedExam.id);
    if (!publication) return;

    revokePublication(publication.id, "Data correction needed", ACTOR);
    const after = getSnapshot();
    expect(after.resultPublications.find((p) => p.id === publication.id)?.status).toBe("revoked");
    expect(after.exams.find((e) => e.id === publishedExam.id)?.status).toBe("result-ready");
  });
});
