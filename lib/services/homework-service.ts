import { setState } from "@/lib/data/store";
import type { Homework, HomeworkSubmission } from "@/lib/types/academics";
import { generateId } from "@/lib/utils";

function nowIso() {
  return new Date().toISOString();
}

export function createHomework(data: Omit<Homework, "id" | "status" | "createdAt" | "updatedAt">): Homework {
  const homework: Homework = { ...data, id: generateId("hw"), status: "draft", createdAt: nowIso(), updatedAt: nowIso() };
  setState((db) => ({ ...db, homework: [homework, ...db.homework] }));
  return homework;
}

export function updateHomework(id: string, patch: Partial<Homework>) {
  setState((db) => ({ ...db, homework: db.homework.map((h) => (h.id === id ? { ...h, ...patch, updatedAt: nowIso() } : h)) }));
}

export function publishHomework(id: string) {
  updateHomework(id, { status: "published" });
}

export function closeHomework(id: string) {
  updateHomework(id, { status: "closed" });
}

export function extendDeadline(id: string, newDueDate: string) {
  updateHomework(id, { dueDate: newDueDate, status: "published" });
}

export function duplicateHomework(id: string): Homework | undefined {
  let created: Homework | undefined;
  setState((db) => {
    const source = db.homework.find((h) => h.id === id);
    if (!source) return db;
    created = { ...source, id: generateId("hw"), status: "draft", createdAt: nowIso(), updatedAt: nowIso() };
    return { ...db, homework: [created, ...db.homework] };
  });
  return created;
}

export function gradeSubmission(submissionId: string, marks: number, feedback: string) {
  setState((db) => ({
    ...db,
    homeworkSubmissions: db.homeworkSubmissions.map((s) => (s.id === submissionId ? { ...s, status: "evaluated", marksObtained: marks, feedback } : s)),
  }));
}

export function requestResubmission(submissionId: string, feedback: string) {
  setState((db) => ({
    ...db,
    homeworkSubmissions: db.homeworkSubmissions.map((s) => (s.id === submissionId ? { ...s, status: "needs-resubmission", feedback } : s)),
  }));
}

export function submitHomework(homeworkId: string, studentId: string, content: string, fileNames: string[]) {
  setState((db) => {
    const existing = db.homeworkSubmissions.find((s) => s.homeworkId === homeworkId && s.studentId === studentId);
    const homework = db.homework.find((h) => h.id === homeworkId);
    const late = homework ? new Date() > new Date(homework.dueDate) : false;
    if (existing) {
      return {
        ...db,
        homeworkSubmissions: db.homeworkSubmissions.map((s) =>
          s.id === existing.id ? { ...s, content, fileNames, submittedAt: nowIso(), status: late ? "late" : "submitted" } : s,
        ),
      };
    }
    const submission: HomeworkSubmission = {
      id: generateId("sub"),
      homeworkId,
      studentId,
      content,
      fileNames,
      submittedAt: nowIso(),
      status: late ? "late" : "submitted",
      acknowledgedByParent: false,
    };
    return { ...db, homeworkSubmissions: [...db.homeworkSubmissions, submission] };
  });
}

export function acknowledgeByParent(submissionId: string) {
  setState((db) => ({
    ...db,
    homeworkSubmissions: db.homeworkSubmissions.map((s) => (s.id === submissionId ? { ...s, acknowledgedByParent: true } : s)),
  }));
}
