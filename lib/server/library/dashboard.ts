// Library Dashboard (Phase 9N) — real, DB-derived counts only. No fake
// reading-engagement score, popular-book ranking, monthly trend %, or fines
// collected — none of that data exists.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryDashboardDto } from "@/lib/api/contracts";

export async function getLibraryDashboard(scope: OrgScope): Promise<LibraryDashboardDto> {
  const branchFilter = scope.branchId ? { branchId: scope.branchId } : {};
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86_400_000);

  const [totalTitles, totalCopies, availableCopies, issuedCopies, lostDamagedCopies, overdueLoans, loansToday, returnsToday] = await Promise.all([
    prisma.libraryBook.count({ where: { schoolId: scope.schoolId, status: "ACTIVE" } }),
    prisma.libraryBookCopy.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: { not: "ARCHIVED" } } }),
    prisma.libraryBookCopy.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "AVAILABLE" } }),
    prisma.libraryBookCopy.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ISSUED" } }),
    prisma.libraryBookCopy.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: { in: ["LOST", "DAMAGED"] } } }),
    prisma.libraryLoan.count({ where: { schoolId: scope.schoolId, ...branchFilter, status: "ISSUED", dueAt: { lt: new Date() } } }),
    prisma.libraryLoan.count({ where: { schoolId: scope.schoolId, ...branchFilter, issuedAt: { gte: startOfDay, lt: endOfDay } } }),
    prisma.libraryLoan.count({ where: { schoolId: scope.schoolId, ...branchFilter, returnedAt: { gte: startOfDay, lt: endOfDay } } }),
  ]);

  return { totalTitles, totalCopies, availableCopies, issuedCopies, lostDamagedCopies, overdueLoans, loansToday, returnsToday };
}
