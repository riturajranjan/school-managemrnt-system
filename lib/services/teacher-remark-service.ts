import { getSnapshot, setState } from "@/lib/data/store";
import type { TeacherRemark, TeacherRemarkType } from "@/lib/types/report-cards";
import { generateId } from "@/lib/utils";

export function upsertRemark(
  examId: string,
  studentId: string,
  type: TeacherRemarkType,
  text: string,
  actor: { name: string; role: string },
  options: { subjectId?: string; aiGenerated?: boolean; aiInfluencedBy?: string[] } = {},
): TeacherRemark {
  const db = getSnapshot();
  const existing = db.teacherRemarks.find((r) => r.examId === examId && r.studentId === studentId && r.type === type && r.subjectId === options.subjectId);
  const now = new Date().toISOString();

  const remark: TeacherRemark = existing
    ? { ...existing, text, aiGenerated: options.aiGenerated ?? false, aiInfluencedBy: options.aiInfluencedBy, authorName: actor.name, authorRole: actor.role, updatedAt: now }
    : {
        id: generateId("tr"),
        examId,
        studentId,
        subjectId: options.subjectId,
        type,
        text,
        aiGenerated: options.aiGenerated ?? false,
        aiInfluencedBy: options.aiInfluencedBy,
        authorName: actor.name,
        authorRole: actor.role,
        createdAt: now,
        updatedAt: now,
      };

  setState((current) => ({
    ...current,
    teacherRemarks: existing ? current.teacherRemarks.map((r) => (r.id === existing.id ? remark : r)) : [...current.teacherRemarks, remark],
  }));
  return remark;
}

export function deleteRemark(remarkId: string) {
  setState((db) => ({ ...db, teacherRemarks: db.teacherRemarks.filter((r) => r.id !== remarkId) }));
}
