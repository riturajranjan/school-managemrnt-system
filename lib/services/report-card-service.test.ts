import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { generateReportCards, publishReportCard, revokeReportCard } from "./report-card-service";

const ACTOR = { name: "Examination Controller", role: "Examination Controller" };

describe("report-card-service", () => {
  beforeEach(() => {
    resetDemoData();
  });

  it("generates a report card only for students who have a calculated result", async () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const template = db.reportCardTemplates[0];
    if (!template) return;

    const resultStudentIds = db.examResults.filter((r) => r.examId === publishedExam.id).map((r) => r.studentId);
    const outcome = await generateReportCards(publishedExam.id, template.id, "all", [...resultStudentIds, "no-such-student"], ACTOR);

    expect(outcome.completed).toBe(resultStudentIds.length);
    expect(outcome.failed).toBe(1);

    const after = getSnapshot();
    const job = after.reportCardGenerationJobs.find((j) => j.id === outcome.jobId);
    expect(job?.status).toBe("completed-with-errors");
  });

  it("publishing a report card sets its status and timestamp", async () => {
    const db = getSnapshot();
    const publishedExam = db.exams.find((e) => e.status === "published");
    if (!publishedExam) return;
    const template = db.reportCardTemplates[0];
    const resultStudentIds = db.examResults.filter((r) => r.examId === publishedExam.id).map((r) => r.studentId).slice(0, 1);
    if (!template || resultStudentIds.length === 0) return;

    await generateReportCards(publishedExam.id, template.id, "single", resultStudentIds, ACTOR);
    const generated = getSnapshot().reportCards.find((rc) => rc.examId === publishedExam.id && rc.studentId === resultStudentIds[0]);
    expect(generated).toBeDefined();
    if (!generated) return;

    publishReportCard(generated.id, ACTOR);
    const published = getSnapshot().reportCards.find((rc) => rc.id === generated.id);
    expect(published?.status).toBe("published");
    expect(published?.publishedAt).toBeTruthy();
  });

  it("revoking a report card marks it revoked", () => {
    const db = getSnapshot();
    const anyCard = db.reportCards[0];
    if (!anyCard) return;
    revokeReportCard(anyCard.id, ACTOR);
    const after = getSnapshot().reportCards.find((rc) => rc.id === anyCard.id);
    expect(after?.status).toBe("revoked");
  });
});
