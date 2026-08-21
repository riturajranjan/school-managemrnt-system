// Library Loans / Circulation (Phase 9N) — real, server-authoritative
// issue/return/renew. A borrower is always exactly one of Student.id or
// Staff.id (never a name string, never a browser-supplied "self" claim for
// staff self-service — that resolves through Staff.userId). Concurrency
// safety on issue is belt-and-suspenders: a conditional copy-status update
// (AVAILABLE -> ISSUED WHERE status = AVAILABLE) plus a partial unique index
// on library_loans(copyId) WHERE status = 'ISSUED' (see the 2026-08-21
// migration) — either guard alone would suffice, together they mirror the
// dual-guard pattern established in Phase 9M's transport trips.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { getCurrentStaffProfile } from "@/lib/server/staff/service";
import { createNotification } from "@/lib/server/notifications/service";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { LibraryLoanDto, LibraryLoanStatusDto, StudentLibraryProfileDto } from "@/lib/api/contracts";
import { resolveLibraryBranch, staffDisplayName, studentDisplayName } from "./access";
import { getOrCreateLibraryPolicy } from "./policy";

const statusToUi = (s: string): LibraryLoanStatusDto => s.toLowerCase() as LibraryLoanStatusDto;

type Row = {
  id: string; copyId: string; studentId: string | null; staffId: string | null;
  issuedAt: Date; dueAt: Date; returnedAt: Date | null; status: string; renewalCount: number; createdAt: Date;
  copy: { accessionNumber: string; bookId: string; book: { title: string } };
  student: { firstName: string; lastName: string | null } | null;
  staff: { firstName: string; lastName: string | null; displayName: string | null; userId: string | null } | null;
};
const select = {
  id: true, copyId: true, studentId: true, staffId: true, issuedAt: true, dueAt: true, returnedAt: true,
  status: true, renewalCount: true, createdAt: true,
  copy: { select: { accessionNumber: true, bookId: true, book: { select: { title: true } } } },
  student: { select: { firstName: true, lastName: true } },
  staff: { select: { firstName: true, lastName: true, displayName: true, userId: true } },
} satisfies Prisma.LibraryLoanSelect;

type Policy = { finePerDay: Prisma.Decimal | number; graceDays: number; maxFineAmount: Prisma.Decimal | number | null; loanDurationDays: number };

function fineFor(loan: { status: string; dueAt: Date; returnedAt: Date | null }, policy: Policy, now: Date): { isOverdue: boolean; daysOverdue: number; fineAmount: number } {
  if (loan.status === "LOST" || loan.status === "CANCELLED") return { isOverdue: false, daysOverdue: 0, fineAmount: 0 };
  const reference = loan.returnedAt ?? now;
  const diffDays = Math.floor((reference.getTime() - loan.dueAt.getTime()) / 86_400_000);
  const overdueDays = Math.max(0, diffDays - policy.graceDays);
  const isOverdue = loan.status === "ISSUED" && overdueDays > 0;
  const finePerDay = Number(policy.finePerDay);
  const maxFine = policy.maxFineAmount === null ? Infinity : Number(policy.maxFineAmount);
  const fineAmount = overdueDays > 0 ? Math.round(Math.min(overdueDays * finePerDay, maxFine) * 100) / 100 : 0;
  return { isOverdue, daysOverdue: overdueDays, fineAmount };
}

function dto(l: Row, policy: Policy, now: Date): LibraryLoanDto {
  const borrowerType = l.studentId ? ("student" as const) : ("staff" as const);
  const borrowerId = l.studentId ?? l.staffId!;
  const borrowerName = l.student ? studentDisplayName(l.student) : staffDisplayName(l.staff!);
  const { isOverdue, daysOverdue, fineAmount } = fineFor(l, policy, now);
  return {
    id: l.id, copyId: l.copyId, accessionNumber: l.copy.accessionNumber, bookId: l.copy.bookId, bookTitle: l.copy.book.title,
    borrowerType, borrowerId, borrowerName, issuedAt: l.issuedAt.toISOString(), dueAt: l.dueAt.toISOString(),
    returnedAt: l.returnedAt?.toISOString() ?? null, status: statusToUi(l.status), renewalCount: l.renewalCount,
    isOverdue, daysOverdue, fineAmount, createdAt: l.createdAt.toISOString(),
  };
}

async function requireLoanInScope(scope: OrgScope, loanId: string): Promise<Row> {
  const l = await prisma.libraryLoan.findFirst({ where: { id: loanId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select });
  if (!l) throw new HttpError("NOT_FOUND", "Loan not found");
  return l;
}

export async function listLoans(scope: OrgScope, params: { status?: string; studentId?: string; staffId?: string; copyId?: string } = {}): Promise<LibraryLoanDto[]> {
  const where: Prisma.LibraryLoanWhereInput = { schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) };
  if (params.status) where.status = params.status.toUpperCase() as never;
  if (params.studentId) where.studentId = params.studentId;
  if (params.staffId) where.staffId = params.staffId;
  if (params.copyId) where.copyId = params.copyId;
  const [rows, policy] = await Promise.all([
    prisma.libraryLoan.findMany({ where, orderBy: { createdAt: "desc" }, select }),
    getOrCreateLibraryPolicy(scope),
  ]);
  const now = new Date();
  return rows.map((r) => dto(r, policy, now));
}

/** The authenticated staff borrower's own loans — resolved via Staff.userId,
 *  never a client-supplied staffId. */
export async function listMyLoans(scope: OrgScope): Promise<LibraryLoanDto[]> {
  const staff = await getCurrentStaffProfile(scope);
  if (!staff) return [];
  const [rows, policy] = await Promise.all([
    prisma.libraryLoan.findMany({ where: { schoolId: scope.schoolId, staffId: staff.id }, orderBy: { createdAt: "desc" }, select }),
    getOrCreateLibraryPolicy(scope),
  ]);
  const now = new Date();
  return rows.map((r) => dto(r, policy, now));
}

export async function getLoan(scope: OrgScope, loanId: string): Promise<LibraryLoanDto> {
  const l = await requireLoanInScope(scope, loanId);
  const policy = await getOrCreateLibraryPolicy(scope);
  return dto(l, policy, new Date());
}

export const issueLoanSchema = z
  .object({ copyId: z.string().min(1), studentId: z.string().min(1).optional(), staffId: z.string().min(1).optional(), dueAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional() })
  .refine((v) => Boolean(v.studentId) !== Boolean(v.staffId), { message: "Exactly one of studentId or staffId is required" });

export async function issueLoan(scope: OrgScope, raw: unknown): Promise<LibraryLoanDto> {
  const input = parseInput(issueLoanSchema, raw);
  const copy = await prisma.libraryBookCopy.findFirst({ where: { id: input.copyId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!copy) throw new HttpError("NOT_FOUND", "Copy not found");
  if (copy.status !== "AVAILABLE") throw new HttpError("CONFLICT", "This copy is not available");

  if (input.studentId) {
    const student = await prisma.student.findFirst({ where: { id: input.studentId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
    if (!student) throw new HttpError("VALIDATION_ERROR", "Borrower must be a real, active student in this school");
  } else {
    const staff = await prisma.staff.findFirst({ where: { id: input.staffId, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
    if (!staff) throw new HttpError("VALIDATION_ERROR", "Borrower must be a real, active staff member in this school");
  }

  const policy = await getOrCreateLibraryPolicy(scope);
  const branchId = await resolveLibraryBranch(scope);
  const issuedAt = new Date();
  const dueAt = input.dueAt ? new Date(`${input.dueAt}T23:59:59.999Z`) : new Date(issuedAt.getTime() + policy.loanDurationDays * 86_400_000);

  try {
    const loanId = await prisma.$transaction(async (tx) => {
      const updated = await tx.libraryBookCopy.updateMany({ where: { id: input.copyId, status: "AVAILABLE" }, data: { status: "ISSUED" } });
      if (updated.count === 0) throw new HttpError("CONFLICT", "This copy is not available");
      const loan = await tx.libraryLoan.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, copyId: input.copyId,
          studentId: input.studentId, staffId: input.staffId, issuedAt, dueAt, issuedByUserId: scope.actor.id,
        },
        select: { id: true },
      });
      await recordAudit(tx, scope, "LIBRARY_BOOK_ISSUED", "LibraryLoan", loan.id, { copyId: input.copyId });

      if (input.staffId) {
        const staffRow = await tx.staff.findUnique({ where: { id: input.staffId }, select: { userId: true } });
        if (staffRow?.userId) {
          await createNotification(tx, {
            tenantId: scope.tenantId, schoolId: scope.schoolId, type: "LIBRARY_BOOK_ISSUED",
            title: "Book issued", body: "A library book has been issued to you.", href: "/library/loans",
            sourceType: "LibraryLoan", sourceId: loan.id, dedupeKey: `LIBRARY_BOOK_ISSUED:${loan.id}`, recipientUserIds: [staffRow.userId],
          });
        }
      }
      return loan.id;
    });
    return getLoan(scope, loanId);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError("CONFLICT", "This copy is not available");
    throw e;
  }
}

export const returnLoanSchema = z.object({ condition: z.enum(["damaged"]).optional() });

export async function returnLoan(scope: OrgScope, loanId: string, raw: unknown = {}): Promise<LibraryLoanDto> {
  const input = parseInput(returnLoanSchema, raw);
  const loan = await requireLoanInScope(scope, loanId);
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    const updated = await tx.libraryLoan.updateMany({
      where: { id: loanId, status: "ISSUED" },
      data: { status: "RETURNED", returnedAt: now, returnedByUserId: scope.actor.id },
    });
    if (updated.count === 0) throw new HttpError("CONFLICT", "This loan is not currently issued");
    await tx.libraryBookCopy.update({ where: { id: loan.copyId }, data: { status: input.condition === "damaged" ? "DAMAGED" : "AVAILABLE" } });
    await recordAudit(tx, scope, "LIBRARY_BOOK_RETURNED", "LibraryLoan", loanId, { condition: input.condition });

    if (loan.staffId && loan.staff?.userId) {
      await createNotification(tx, {
        tenantId: scope.tenantId, schoolId: scope.schoolId, type: "LIBRARY_BOOK_RETURNED",
        title: "Book returned", body: "Your library book return has been recorded.", href: "/library/loans",
        sourceType: "LibraryLoan", sourceId: loanId, dedupeKey: `LIBRARY_BOOK_RETURNED:${loanId}`, recipientUserIds: [loan.staff.userId],
      });
    }
  });
  return getLoan(scope, loanId);
}

/** `privileged` (library.manage) may renew any loan; otherwise the caller
 *  must be the loan's own staff borrower (via Staff.userId) — a 404 (not
 *  403) for anyone else, matching the no-existence-leak pattern used
 *  elsewhere in this codebase (e.g. Phase 9M's transport trip self-service). */
export async function renewLoan(scope: OrgScope, loanId: string, privileged: boolean): Promise<LibraryLoanDto> {
  const loan = await requireLoanInScope(scope, loanId);
  if (!privileged) {
    const staff = await getCurrentStaffProfile(scope);
    if (!staff || staff.id !== loan.staffId) throw new HttpError("NOT_FOUND", "Loan not found");
  }
  const policy = await getOrCreateLibraryPolicy(scope);
  const newDueAt = new Date(Date.now() + policy.loanDurationDays * 86_400_000);
  const updated = await prisma.libraryLoan.updateMany({ where: { id: loanId, status: "ISSUED" }, data: { dueAt: newDueAt, renewalCount: { increment: 1 } } });
  if (updated.count === 0) throw new HttpError("CONFLICT", "This loan is not currently issued");
  await recordAudit(prisma, scope, "LIBRARY_BOOK_RENEWED", "LibraryLoan", loanId, { newDueAt: newDueAt.toISOString() });
  return getLoan(scope, loanId);
}

/** A copy reported lost, whether currently on loan or sitting on the shelf.
 *  If it was ISSUED, the active loan is closed as LOST (never silently left
 *  dangling as ISSUED forever). */
export async function markCopyLost(scope: OrgScope, copyId: string): Promise<{ copyId: string }> {
  const copy = await prisma.libraryBookCopy.findFirst({ where: { id: copyId, schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}) }, select: { id: true, status: true } });
  if (!copy) throw new HttpError("NOT_FOUND", "Copy not found");
  if (copy.status !== "AVAILABLE" && copy.status !== "ISSUED") throw new HttpError("VALIDATION_ERROR", "Only an available or issued copy can be marked lost");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.libraryBookCopy.updateMany({ where: { id: copyId, status: { in: ["AVAILABLE", "ISSUED"] } }, data: { status: "LOST" } });
    if (updated.count === 0) throw new HttpError("CONFLICT", "Copy status changed — retry");
    if (copy.status === "ISSUED") {
      const now = new Date();
      await tx.libraryLoan.updateMany({ where: { copyId, status: "ISSUED" }, data: { status: "LOST", returnedAt: now, returnedByUserId: scope.actor.id } });
    }
    await recordAudit(tx, scope, "LIBRARY_COPY_MARKED_LOST", "LibraryBookCopy", copyId);
  });
  return { copyId };
}

/** Student 360 Library tab — real active loans + recent return history. */
export async function getStudentLibraryProfile(scope: OrgScope, studentId: string): Promise<StudentLibraryProfileDto> {
  const [activeRows, historyRows, policy] = await Promise.all([
    prisma.libraryLoan.findMany({ where: { studentId, schoolId: scope.schoolId, status: "ISSUED" }, orderBy: { dueAt: "asc" }, select }),
    prisma.libraryLoan.findMany({ where: { studentId, schoolId: scope.schoolId, status: { in: ["RETURNED", "LOST"] } }, orderBy: { createdAt: "desc" }, take: 10, select }),
    getOrCreateLibraryPolicy(scope),
  ]);
  const now = new Date();
  return { activeLoans: activeRows.map((r) => dto(r, policy, now)), recentHistory: historyRows.map((r) => dto(r, policy, now)) };
}
