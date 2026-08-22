// Student 360 / Staff generated-document history (Phase 9V) — real
// GeneratedDocument rows only, clearly a DIFFERENT concept from the existing
// uploaded StudentDocument/StaffDocument compliance tabs.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { GeneratedDocumentDto } from "@/lib/api/contracts";
import { generatedDocumentDto } from "./generate";

const select = {
  id: true, documentNumber: true, status: true, generatedByName: true, generatedAt: true, voidedAt: true, voidReason: true,
  studentId: true, staffId: true, templateVersion: true, renderedSnapshot: true,
  template: { select: { id: true, name: true, docType: true, kind: true, subjectType: true } },
} as const;

export async function getStudentGeneratedDocuments(scope: OrgScope, studentId: string): Promise<GeneratedDocumentDto[]> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");
  const rows = await prisma.generatedDocument.findMany({ where: { schoolId: scope.schoolId, studentId }, select, orderBy: { generatedAt: "desc" } });
  return rows.map(generatedDocumentDto);
}

export async function getStaffGeneratedDocuments(scope: OrgScope, staffId: string): Promise<GeneratedDocumentDto[]> {
  const staff = await prisma.staff.findFirst({ where: { id: staffId, schoolId: scope.schoolId }, select: { id: true } });
  if (!staff) throw new HttpError("NOT_FOUND", "Staff member not found");
  const rows = await prisma.generatedDocument.findMany({ where: { schoolId: scope.schoolId, staffId }, select, orderBy: { generatedAt: "desc" } });
  return rows.map(generatedDocumentDto);
}
