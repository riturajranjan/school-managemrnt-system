// Cafeteria Dashboard (Phase 9T) — DB-derived counts only. No fabricated
// sales, revenue, profit, wastage %, or satisfaction score.
import { prisma } from "@/lib/db/prisma";
import type { OrgScope } from "@/lib/server/api/scope";
import type { CafeteriaDashboardDto } from "@/lib/api/contracts";

export async function getCafeteriaDashboard(scope: OrgScope): Promise<CafeteriaDashboardDto> {
  const branchWhere = scope.branchId ? { branchId: scope.branchId } : {};
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday.getTime() + 86_400_000);
  // CafeteriaMenu.date is a pure @db.Date (calendar-day) column, not a
  // timestamptz — comparing it against a local-timezone midnight RANGE is
  // wrong (Prisma truncates Date range bounds to their own UTC calendar
  // date for a Date column, which silently excludes "today" whenever the
  // server's local timezone is ahead of UTC). Match the same UTC-normalized
  // date-string convention used everywhere else this field is written/read
  // (createMenu, listMenus) with an exact equality instead.
  const todayDateOnly = new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00.000Z`);

  const [mealsServedToday, studentMealsToday, staffMealsToday, activeItems, menusToday, locationCount] = await Promise.all([
    prisma.cafeteriaMealRecord.count({ where: { schoolId: scope.schoolId, ...branchWhere, servedAt: { gte: startOfToday, lt: endOfToday } } }),
    prisma.cafeteriaMealRecord.count({ where: { schoolId: scope.schoolId, ...branchWhere, servedAt: { gte: startOfToday, lt: endOfToday }, studentId: { not: null } } }),
    prisma.cafeteriaMealRecord.count({ where: { schoolId: scope.schoolId, ...branchWhere, servedAt: { gte: startOfToday, lt: endOfToday }, staffId: { not: null } } }),
    prisma.cafeteriaItem.count({ where: { schoolId: scope.schoolId, status: "ACTIVE" } }),
    prisma.cafeteriaMenu.count({ where: { schoolId: scope.schoolId, ...branchWhere, date: todayDateOnly } }),
    prisma.cafeteriaLocation.count({ where: { schoolId: scope.schoolId, ...branchWhere, status: "ACTIVE" } }),
  ]);

  return { mealsServedToday, studentMealsToday, staffMealsToday, activeItems, menusToday, locationCount };
}
