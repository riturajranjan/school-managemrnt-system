// Manual Journal Entries (Phase 9G) — real, PostgreSQL-backed, double-entry.
// The existing Accounting UI creates+posts a manual journal in one action (no
// draft-editing workflow), so createAndPostJournalEntry() is the one write
// path manual entry uses — but the DRAFT status still exists in the schema
// for automatic Fee postings' internal consistency and for API completeness
// (createJournalEntry / postJournalEntry are exposed separately too).
//
// INVARIANTS (enforced here, never trusted from the client):
//   - every line has EITHER debit > 0 XOR credit > 0 (never both, never neither)
//   - at least 2 lines
//   - sum(debit) === sum(credit) before a journal can become POSTED
// Once POSTED, a journal is immutable — no edit endpoint exists. A correction
// is always reverseJournalEntry(), which mirrors every line with debit/credit
// swapped; reversalOfId is DB-unique so the same entry can never be reversed
// twice, even under a concurrent double-click (the loser's write fails the
// unique constraint and is surfaced as JOURNAL_ALREADY_REVERSED).
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { CreateJournalEntryRequest, JournalEntryDetailDto, JournalEntryListItemDto, JournalSourceTypeDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { nextJournalEntryNumber } from "./entry-number";
import { isBroadAccountingManager, resolveAccountingBranch } from "./access";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const SOURCE_TO_UI: Record<string, JournalSourceTypeDto> = { MANUAL: "manual", FEE_PAYMENT: "fee_payment", FEE_REFUND: "fee_refund" };

const lineSchema = z
  .object({ accountId: z.string().min(1), debit: z.number().min(0).max(100_000_000).optional(), credit: z.number().min(0).max(100_000_000).optional(), description: z.string().trim().max(200).optional() })
  .refine((l) => {
    const d = l.debit ?? 0, c = l.credit ?? 0;
    return (d > 0) !== (c > 0); // exactly one of debit/credit must be positive
  }, { message: "Each line must have either a debit or a credit amount, never both or neither" });

export const createJournalEntrySchema = z.object({ entryDate: dateStr, description: z.string().trim().min(1).max(500), lines: z.array(lineSchema).min(2) });

const listSelect = {
  id: true, entryNumber: true, entryDate: true, description: true, status: true, sourceType: true, sourceId: true, reversalOfId: true,
  lines: { select: { debit: true } },
  reversedBy: { select: { id: true } },
} satisfies Prisma.JournalEntrySelect;
type EntryRow = Prisma.JournalEntryGetPayload<{ select: typeof listSelect }>;

function listDto(e: EntryRow): JournalEntryListItemDto {
  return {
    id: e.id, entryNumber: e.entryNumber, entryDate: dateToUi(e.entryDate), description: e.description,
    status: e.status.toLowerCase() as JournalEntryListItemDto["status"], sourceType: SOURCE_TO_UI[e.sourceType], sourceId: e.sourceId,
    totalAmount: e.lines.reduce((s, l) => s + dec(l.debit), 0), reversalOfId: e.reversalOfId, isReversed: e.reversedBy.length > 0,
  };
}

export const listJournalEntriesSchema = z.object({ sourceType: z.enum(["manual", "fee_payment", "fee_refund"]).optional(), status: z.enum(["draft", "posted", "reversed"]).optional(), from: dateStr.optional(), to: dateStr.optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20) });

const SOURCE_TO_DB: Record<string, string> = { manual: "MANUAL", fee_payment: "FEE_PAYMENT", fee_refund: "FEE_REFUND" };

export async function listJournalEntries(scope: OrgScope, raw: unknown): Promise<{ data: JournalEntryListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listJournalEntriesSchema, raw);
  const where: Prisma.JournalEntryWhereInput = {
    schoolId: scope.schoolId, ...(scope.branchId ? { branchId: scope.branchId } : {}),
    ...(input.sourceType ? { sourceType: SOURCE_TO_DB[input.sourceType] as never } : {}),
    ...(input.status ? { status: input.status.toUpperCase() as never } : {}),
    ...(input.from || input.to ? { entryDate: { ...(input.from ? { gte: parseDate(input.from) } : {}), ...(input.to ? { lte: parseDate(input.to) } : {}) } } : {}),
  };
  const [total, rows] = await Promise.all([
    prisma.journalEntry.count({ where }),
    prisma.journalEntry.findMany({ where, orderBy: [{ entryDate: "desc" }, { createdAt: "desc" }], skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: listSelect }),
  ]);
  return { data: rows.map(listDto), meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

const detailSelect = {
  ...listSelect,
  createdByName: true, postedAt: true,
  lines: { select: { id: true, accountId: true, account: { select: { code: true, name: true } }, debit: true, credit: true, description: true } },
} satisfies Prisma.JournalEntrySelect;
type DetailRow = Prisma.JournalEntryGetPayload<{ select: typeof detailSelect }>;

function detailDto(e: DetailRow): JournalEntryDetailDto {
  return {
    ...listDto({ ...e, lines: e.lines.map((l) => ({ debit: l.debit })) }),
    lines: e.lines.map((l) => ({ id: l.id, accountId: l.accountId, accountCode: l.account.code, accountName: l.account.name, debit: dec(l.debit), credit: dec(l.credit), description: l.description })),
    createdByName: e.createdByName, postedAt: e.postedAt?.toISOString() ?? null,
  };
}

async function requireEntryInScope(scope: OrgScope, journalEntryId: string): Promise<DetailRow> {
  const row = await prisma.journalEntry.findFirst({ where: { id: journalEntryId, schoolId: scope.schoolId }, select: detailSelect });
  if (!row) throw new HttpError("JOURNAL_ENTRY_NOT_FOUND", "Journal entry not found");
  return row;
}

export async function getJournalEntry(scope: OrgScope, journalEntryId: string): Promise<JournalEntryDetailDto> {
  return detailDto(await requireEntryInScope(scope, journalEntryId));
}

function assertBalanced(input: CreateJournalEntryRequest): { totalDebit: number; totalCredit: number } {
  const totalDebit = Math.round(input.lines.reduce((s, l) => s + (l.debit ?? 0), 0) * 100) / 100;
  const totalCredit = Math.round(input.lines.reduce((s, l) => s + (l.credit ?? 0), 0) * 100) / 100;
  if (totalDebit !== totalCredit) throw new HttpError("JOURNAL_NOT_BALANCED", `Journal is not balanced — debits (${totalDebit}) do not equal credits (${totalCredit})`);
  if (totalDebit <= 0) throw new HttpError("JOURNAL_NOT_BALANCED", "Journal must have a positive amount");
  return { totalDebit, totalCredit };
}

async function validateAccounts(schoolId: string, accountIds: string[]): Promise<void> {
  const found = await prisma.accountingAccount.count({ where: { id: { in: accountIds }, schoolId, status: "ACTIVE" } });
  if (found !== new Set(accountIds).size) throw new HttpError("ACCOUNTING_ACCOUNT_NOT_FOUND", "One or more accounts were not found or are archived");
}

/** Create + POST a manual journal in one atomic step — matches the existing
 * UI's single "Post manual journal" action. */
export async function createAndPostJournalEntry(scope: OrgScope, raw: unknown): Promise<JournalEntryDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createJournalEntrySchema, raw);
  assertBalanced(input);
  await validateAccounts(scope.schoolId, input.lines.map((l) => l.accountId));
  const branchId = await resolveAccountingBranch(scope);

  const created = await prisma.$transaction(async (tx) => {
    const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, parseDate(input.entryDate).getUTCFullYear());
    const row = await tx.journalEntry.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId, academicSessionId: scope.academicSessionId,
        entryNumber, entryDate: parseDate(input.entryDate), description: input.description, status: "POSTED",
        sourceType: "MANUAL", createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
        lines: { create: input.lines.map((l) => ({ accountId: l.accountId, debit: l.debit ?? 0, credit: l.credit ?? 0, description: l.description })) },
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "JOURNAL_CREATED", "JournalEntry", row.id, { entryNumber });
    await recordAudit(tx, scope, "JOURNAL_POSTED", "JournalEntry", row.id, { entryNumber });
    return row;
  });
  return getJournalEntry(scope, created.id);
}

export const reverseJournalEntrySchema = z.object({ reason: z.string().trim().min(1).max(500) });

export async function reverseJournalEntry(scope: OrgScope, journalEntryId: string, raw: unknown): Promise<JournalEntryDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(reverseJournalEntrySchema, raw);
  const original = await requireEntryInScope(scope, journalEntryId);
  if (original.status !== "POSTED") throw new HttpError("JOURNAL_NOT_POSTED", "Only a posted journal can be reversed");
  const branchId = await resolveAccountingBranch(scope);

  try {
    const reversalId = await prisma.$transaction(async (tx) => {
      const entryNumber = await nextJournalEntryNumber(tx, scope.schoolId, new Date().getUTCFullYear());
      const reversal = await tx.journalEntry.create({
        data: {
          tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
          academicSessionId: scope.academicSessionId, entryNumber, entryDate: new Date(), description: `Reversal of ${original.entryNumber}: ${input.reason}`,
          status: "POSTED", sourceType: original.sourceType as never, sourceId: original.id, reversalOfId: original.id,
          createdByUserId: scope.actor.id, createdByName: scope.actor.name, postedAt: new Date(),
          lines: { create: original.lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: l.description })) },
        },
        select: { id: true },
      });
      await tx.journalEntry.update({ where: { id: original.id }, data: { status: "REVERSED" } });
      await recordAudit(tx, scope, "JOURNAL_REVERSED", "JournalEntry", original.id, { reversalEntryNumber: entryNumber, reason: input.reason });
      return reversal.id;
    });
    return getJournalEntry(scope, reversalId);
  } catch (err) {
    // reversalOfId is DB-unique — a concurrent second reversal attempt hits
    // the constraint here, never creating a duplicate reversal.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") throw new HttpError("JOURNAL_ALREADY_REVERSED", "This entry has already been reversed");
    throw err;
  }
}
