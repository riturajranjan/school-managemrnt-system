// Document Studio dashboard (Phase 9V) — DB-derived counts only. No
// fabricated delivery rate, signed %, or approval %.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { DocumentStudioDashboardDto } from "@/lib/api/contracts";

export async function getDocumentStudioDashboard(scope: OrgScope): Promise<DocumentStudioDashboardDto> {
  const now = new Date();
  const startOfDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [activeTemplates, generatedToday, generatedThisMonth, voidedCount, studentDocuments, staffDocuments] = await Promise.all([
    prisma.documentTemplate.count({ where: { schoolId: scope.schoolId, status: "ACTIVE" } }),
    prisma.generatedDocument.count({ where: { schoolId: scope.schoolId, generatedAt: { gte: startOfDay } } }),
    prisma.generatedDocument.count({ where: { schoolId: scope.schoolId, generatedAt: { gte: startOfMonth } } }),
    prisma.generatedDocument.count({ where: { schoolId: scope.schoolId, status: "VOID" } }),
    prisma.generatedDocument.count({ where: { schoolId: scope.schoolId, subjectType: "STUDENT" } }),
    prisma.generatedDocument.count({ where: { schoolId: scope.schoolId, subjectType: "STAFF" } }),
  ]);

  return { activeTemplates, generatedToday, generatedThisMonth, voidedCount, studentDocuments, staffDocuments };
}
