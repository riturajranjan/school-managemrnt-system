// Budgets (Production Accounting checkpoint) — real, PostgreSQL-backed.
// BUDGETED is the only figure ever persisted (BudgetAllocation.amount).
// ACTUAL is always derived live from POSTED JournalLines against the
// allocation's real AccountingAccount within [periodStart, periodEnd] —
// never stored, never computed from a PurchaseOrder (which carries no
// ledger weight at all — see purchase-orders.ts). Sign convention reuses
// accounts.ts's normalBalance() verbatim: no second ledger-sign rule.
// Allocations are only ever written at create time (one atomic
// transaction) — no allocation-edit endpoint exists, so an approved
// budget's stored figures can never be silently rewritten; only the
// derived actual/variance changes as new journals post.
import type { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { ListMeta } from "@/lib/server/api/response";
import type { BudgetAllocationDto, BudgetDetailDto, BudgetListItemDto, BudgetStatusDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { normalBalance } from "./accounts";
import { isBroadAccountingManager } from "./access";

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");
const parseDate = (d: string) => new Date(`${d}T00:00:00.000Z`);
const dateToUi = (d: Date) => d.toISOString().slice(0, 10);
const STATUS_TO_UI: Record<string, BudgetStatusDto> = { DRAFT: "draft", APPROVED: "approved" };
const STATUS_TO_DB: Record<string, string> = { draft: "DRAFT", approved: "APPROVED" };
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Live sum of POSTED JournalLine movement per account within the budget's
 * period (and branch, when the budget is branch-scoped) — the sole "actual"
 * authority. */
async function actualsByAccount(schoolId: string, branchId: string | null, periodStart: Date, periodEnd: Date, accounts: { id: string; type: string }[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (accounts.length === 0) return result;
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: {
      accountId: { in: accounts.map((a) => a.id) },
      journalEntry: { schoolId, status: "POSTED", entryDate: { gte: periodStart, lte: periodEnd }, ...(branchId ? { branchId } : {}) },
    },
    _sum: { debit: true, credit: true },
  });
  const sumsById = new Map(grouped.map((g) => [g.accountId, { debit: dec(g._sum.debit), credit: dec(g._sum.credit) }]));
  for (const a of accounts) {
    const sums = sumsById.get(a.id) ?? { debit: 0, credit: 0 };
    result.set(a.id, round2(normalBalance(a.type, sums.debit, sums.credit)));
  }
  return result;
}

async function allocationDtosFor(schoolId: string, budget: BudgetListRow): Promise<BudgetAllocationDto[]> {
  const actuals = await actualsByAccount(schoolId, budget.branchId, budget.periodStart, budget.periodEnd, budget.allocations.map((a) => ({ id: a.accountingAccountId, type: a.account.type })));
  return budget.allocations.map((a) => {
    const budgeted = dec(a.amount);
    const actual = actuals.get(a.accountingAccountId) ?? 0;
    return { id: a.id, accountingAccountId: a.accountingAccountId, accountCode: a.account.code, accountName: a.account.name, budgeted, actual, variance: round2(budgeted - actual) };
  });
}

function listDto(allocations: BudgetAllocationDto[], b: BudgetListRow): BudgetListItemDto {
  const totalBudgeted = round2(allocations.reduce((s, a) => s + a.budgeted, 0));
  const totalActual = round2(allocations.reduce((s, a) => s + a.actual, 0));
  return {
    id: b.id, name: b.name, periodStart: dateToUi(b.periodStart), periodEnd: dateToUi(b.periodEnd), status: STATUS_TO_UI[b.status],
    totalBudgeted, totalActual, totalVariance: round2(totalBudgeted - totalActual), createdAt: b.createdAt.toISOString(),
  };
}

const allocationSelect = { id: true, accountingAccountId: true, amount: true, account: { select: { code: true, name: true, type: true } } } satisfies Prisma.BudgetAllocationSelect;

const listSelect = { id: true, name: true, branchId: true, periodStart: true, periodEnd: true, status: true, createdAt: true, allocations: { select: allocationSelect } } satisfies Prisma.BudgetSelect;
type BudgetListRow = Prisma.BudgetGetPayload<{ select: typeof listSelect }>;

export const listBudgetsSchema = z.object({ status: z.enum(["draft", "approved"]).optional(), page: z.number().int().min(1).default(1), pageSize: z.number().int().min(1).max(100).default(20) });

export async function listBudgets(scope: OrgScope, raw: unknown): Promise<{ data: BudgetListItemDto[]; meta: ListMeta }> {
  const input = parseInput(listBudgetsSchema, raw);
  const where = { schoolId: scope.schoolId, ...(input.status ? { status: STATUS_TO_DB[input.status] as never } : {}) };
  const [total, rows] = await Promise.all([
    prisma.budget.count({ where }),
    prisma.budget.findMany({ where, orderBy: { createdAt: "desc" }, skip: (input.page - 1) * input.pageSize, take: input.pageSize, select: listSelect }),
  ]);
  const data = await Promise.all(rows.map(async (b) => listDto(await allocationDtosFor(scope.schoolId, b), b)));
  return { data, meta: { page: input.page, pageSize: input.pageSize, total, totalPages: Math.max(1, Math.ceil(total / input.pageSize)) } };
}

const detailSelect = { ...listSelect, notes: true, approvedByName: true, approvedAt: true } satisfies Prisma.BudgetSelect;
type BudgetDetailRow = Prisma.BudgetGetPayload<{ select: typeof detailSelect }>;

async function requireBudgetInScope(scope: OrgScope, budgetId: string): Promise<BudgetDetailRow> {
  const row = await prisma.budget.findFirst({ where: { id: budgetId, schoolId: scope.schoolId }, select: detailSelect });
  if (!row) throw new HttpError("BUDGET_NOT_FOUND", "Budget not found");
  return row;
}

export async function getBudget(scope: OrgScope, budgetId: string): Promise<BudgetDetailDto> {
  const row = await requireBudgetInScope(scope, budgetId);
  const allocations = await allocationDtosFor(scope.schoolId, row);
  return { ...listDto(allocations, row), notes: row.notes, allocations, approvedByName: row.approvedByName, approvedAt: row.approvedAt?.toISOString() ?? null };
}

export const createBudgetSchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    periodStart: dateStr,
    periodEnd: dateStr,
    notes: z.string().trim().max(1000).optional(),
    allocations: z.array(z.object({ accountingAccountId: z.string().min(1), amount: z.number().min(0.01).max(100_000_000) })).min(1).max(200),
  })
  .refine((v) => parseDate(v.periodEnd).getTime() >= parseDate(v.periodStart).getTime(), { message: "periodEnd must be on or after periodStart", path: ["periodEnd"] });

export async function createBudget(scope: OrgScope, raw: unknown): Promise<BudgetDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createBudgetSchema, raw);

  const accountIds = input.allocations.map((a) => a.accountingAccountId);
  if (new Set(accountIds).size !== accountIds.length) throw new HttpError("INVALID_BUDGET_ALLOCATION", "Each account may only be allocated once per budget");
  const accounts = await prisma.accountingAccount.findMany({ where: { id: { in: accountIds }, schoolId: scope.schoolId, status: "ACTIVE" }, select: { id: true } });
  if (accounts.length !== accountIds.length) throw new HttpError("ACCOUNTING_ACCOUNT_NOT_FOUND", "One or more accounts were not found or are archived");

  const branchId = scope.branchId ?? null;

  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.budget.create({
      data: {
        tenantId: scope.tenantId, schoolId: scope.schoolId, branchId,
        name: input.name, periodStart: parseDate(input.periodStart), periodEnd: parseDate(input.periodEnd), notes: input.notes,
        status: "DRAFT", createdByUserId: scope.actor.id, createdByName: scope.actor.name,
        allocations: { create: input.allocations.map((a) => ({ accountingAccountId: a.accountingAccountId, amount: a.amount })) },
      },
      select: { id: true },
    });
    await recordAudit(tx, scope, "BUDGET_CREATED", "Budget", row.id, { name: input.name, allocationCount: input.allocations.length });
    return row;
  });
  return getBudget(scope, created.id);
}

export async function approveBudget(scope: OrgScope, budgetId: string): Promise<BudgetDetailDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const result = await prisma.$transaction(async (tx) => {
    const { count } = await tx.budget.updateMany({
      where: { id: budgetId, schoolId: scope.schoolId, status: "DRAFT" },
      data: { status: "APPROVED", approvedByUserId: scope.actor.id, approvedByName: scope.actor.name, approvedAt: new Date() },
    });
    if (count === 1) await recordAudit(tx, scope, "BUDGET_APPROVED", "Budget", budgetId, {});
    return count;
  });
  if (result === 0) {
    const existing = await prisma.budget.findFirst({ where: { id: budgetId, schoolId: scope.schoolId }, select: { status: true } });
    if (!existing) throw new HttpError("BUDGET_NOT_FOUND", "Budget not found");
    throw new HttpError("INVALID_BUDGET_TRANSITION", `Cannot approve a budget in "${existing.status.toLowerCase()}" status`);
  }
  return getBudget(scope, budgetId);
}
