// Chart of Accounts (Phase 9G) — real, PostgreSQL-backed. Account TYPE is
// never changeable after creation (would corrupt the historical meaning of
// every JournalLine already posted against it) — the update schema has no
// `type` field at all, impossible by construction, not just runtime-checked.
// There is no delete endpoint — archive (status) is the only removal path,
// so a posted-against account can never be destructively removed.
import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import { recordAudit } from "@/lib/server/api/audit";
import { parseInput } from "@/lib/server/validation";
import { z } from "zod";
import type { OrgScope } from "@/lib/server/api/scope";
import type { AccountingAccountDto, AccountingAccountTypeDto } from "@/lib/api/contracts";
import { dec } from "@/lib/server/fees/money";
import { isBroadAccountingManager } from "./access";

const TYPE_TO_DB: Record<AccountingAccountTypeDto, string> = { asset: "ASSET", liability: "LIABILITY", equity: "EQUITY", income: "INCOME", expense: "EXPENSE" };
const typeToUi = (t: string): AccountingAccountTypeDto => t.toLowerCase() as AccountingAccountTypeDto;

/** ASSET/EXPENSE carry a normal DEBIT balance; LIABILITY/EQUITY/INCOME carry
 * a normal CREDIT balance — the standard accounting sign convention applied
 * when presenting a balance as a single signed number. */
function normalBalance(type: string, debit: number, credit: number): number {
  return type === "ASSET" || type === "EXPENSE" ? debit - credit : credit - debit;
}

async function balancesByAccount(schoolId: string, accountIds?: string[]): Promise<Map<string, { debit: number; credit: number }>> {
  const grouped = await prisma.journalLine.groupBy({
    by: ["accountId"],
    where: { journalEntry: { schoolId, status: "POSTED" }, ...(accountIds ? { accountId: { in: accountIds } } : {}) },
    _sum: { debit: true, credit: true },
  });
  return new Map(grouped.map((g) => [g.accountId, { debit: dec(g._sum.debit), credit: dec(g._sum.credit) }]));
}

function toDto(a: { id: string; code: string; name: string; type: string; parentId: string | null; description: string | null; status: string; systemKey: string | null }, bal: { debit: number; credit: number } | undefined): AccountingAccountDto {
  return {
    id: a.id, code: a.code, name: a.name, type: typeToUi(a.type), parentId: a.parentId, description: a.description,
    status: a.status === "ACTIVE" ? "active" : "archived", systemKey: a.systemKey,
    balance: Math.round(normalBalance(a.type, bal?.debit ?? 0, bal?.credit ?? 0) * 100) / 100,
  };
}

/** Guarantees the CASH/BANK system accounts exist even before the first Fee
 * payment ever posts (which is otherwise the only place that creates them) —
 * so a manual Income/Expense quick-entry always has a real account to debit/
 * credit, never a placeholder. Idempotent (upsert on the systemKey unique
 * constraint); called on every account list read, which is cheap and safe. */
async function ensureCoreSystemAccounts(scope: OrgScope): Promise<void> {
  await Promise.all([
    prisma.accountingAccount.upsert({ where: { schoolId_systemKey: { schoolId: scope.schoolId, systemKey: "CASH" } }, create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId, code: "9001", name: "Cash", type: "ASSET", systemKey: "CASH" }, update: {} }),
    prisma.accountingAccount.upsert({ where: { schoolId_systemKey: { schoolId: scope.schoolId, systemKey: "BANK" } }, create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId, code: "9002", name: "Bank (clearing)", type: "ASSET", systemKey: "BANK" }, update: {} }),
  ]);
}

export async function listAccountingAccounts(scope: OrgScope, params: { type?: AccountingAccountTypeDto; status?: AccountingAccountStatusDtoInternal; search?: string } = {}): Promise<AccountingAccountDto[]> {
  await ensureCoreSystemAccounts(scope);
  const where: Prisma.AccountingAccountWhereInput = {
    schoolId: scope.schoolId,
    ...(params.type ? { type: TYPE_TO_DB[params.type] as never } : {}),
    ...(params.status ? { status: params.status.toUpperCase() as never } : {}),
    ...(params.search?.trim() ? { OR: [{ name: { contains: params.search.trim(), mode: "insensitive" } }, { code: { contains: params.search.trim(), mode: "insensitive" } }] } : {}),
  };
  const rows = await prisma.accountingAccount.findMany({ where, orderBy: { code: "asc" } });
  const balances = await balancesByAccount(scope.schoolId, rows.map((r) => r.id));
  return rows.map((r) => toDto(r, balances.get(r.id)));
}
type AccountingAccountStatusDtoInternal = "active" | "archived";

async function requireAccountInScope(scope: OrgScope, accountId: string) {
  const row = await prisma.accountingAccount.findFirst({ where: { id: accountId, schoolId: scope.schoolId } });
  if (!row) throw new HttpError("ACCOUNTING_ACCOUNT_NOT_FOUND", "Account not found");
  return row;
}

export async function getAccountingAccount(scope: OrgScope, accountId: string): Promise<AccountingAccountDto> {
  const row = await requireAccountInScope(scope, accountId);
  const balances = await balancesByAccount(scope.schoolId, [accountId]);
  return toDto(row, balances.get(accountId));
}

export const createAccountingAccountSchema = z.object({
  code: z.string().trim().min(1).max(20),
  name: z.string().trim().min(1).max(120),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  parentId: z.string().min(1).optional(),
  description: z.string().trim().max(500).optional(),
});

export async function createAccountingAccount(scope: OrgScope, raw: unknown): Promise<AccountingAccountDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const input = parseInput(createAccountingAccountSchema, raw);
  const clash = await prisma.accountingAccount.findFirst({ where: { schoolId: scope.schoolId, code: { equals: input.code, mode: "insensitive" } }, select: { id: true } });
  if (clash) throw new HttpError("ACCOUNTING_ACCOUNT_CODE_EXISTS", "An account with this code already exists");
  if (input.parentId) {
    const parent = await prisma.accountingAccount.findFirst({ where: { id: input.parentId, schoolId: scope.schoolId }, select: { id: true, type: true } });
    if (!parent) throw new HttpError("INVALID_PARENT_ACCOUNT", "Parent account not found");
    if (parent.type !== TYPE_TO_DB[input.type]) throw new HttpError("INVALID_PARENT_ACCOUNT", "Parent account must be the same type");
  }
  const created = await prisma.$transaction(async (tx) => {
    const row = await tx.accountingAccount.create({
      data: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId, code: input.code, name: input.name, type: TYPE_TO_DB[input.type] as never, parentId: input.parentId, description: input.description },
    });
    await recordAudit(tx, scope, "ACCOUNT_CREATED", "AccountingAccount", row.id, { code: row.code, name: row.name });
    return row;
  });
  return toDto(created, undefined);
}

export const updateAccountingAccountSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(500).nullable().optional(),
  parentId: z.string().min(1).nullable().optional(),
  status: z.enum(["active", "archived"]).optional(),
});

/** Walk the candidate's new parent chain to ensure `accountId` never becomes its own ancestor. */
async function assertNoParentCycle(schoolId: string, accountId: string, newParentId: string): Promise<void> {
  let cursor: string | null = newParentId;
  let guard = 0;
  while (cursor && guard < 50) {
    if (cursor === accountId) throw new HttpError("INVALID_PARENT_ACCOUNT", "This would create a circular parent hierarchy");
    const row: { parentId: string | null } | null = await prisma.accountingAccount.findFirst({ where: { id: cursor, schoolId }, select: { parentId: true } });
    cursor = row?.parentId ?? null;
    guard++;
  }
}

export async function updateAccountingAccount(scope: OrgScope, accountId: string, raw: unknown): Promise<AccountingAccountDto> {
  if (!(await isBroadAccountingManager(scope))) throw new HttpError("FORBIDDEN", "You do not have permission to perform this action.");
  const existing = await requireAccountInScope(scope, accountId);
  const input = parseInput(updateAccountingAccountSchema, raw);
  if (input.parentId) {
    const parent = await prisma.accountingAccount.findFirst({ where: { id: input.parentId, schoolId: scope.schoolId }, select: { id: true, type: true } });
    if (!parent) throw new HttpError("INVALID_PARENT_ACCOUNT", "Parent account not found");
    if (parent.type !== existing.type) throw new HttpError("INVALID_PARENT_ACCOUNT", "Parent account must be the same type");
    await assertNoParentCycle(scope.schoolId, accountId, input.parentId);
  }
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.accountingAccount.update({
      where: { id: accountId },
      data: { name: input.name, description: input.description === undefined ? undefined : input.description, parentId: input.parentId === undefined ? undefined : input.parentId, status: input.status ? (input.status === "active" ? "ACTIVE" : "ARCHIVED") : undefined },
    });
    await recordAudit(tx, scope, input.status ? "ACCOUNT_STATUS_CHANGED" : "ACCOUNT_UPDATED", "AccountingAccount", accountId, input.status ? { status: input.status } : undefined);
    return row;
  });
  const balances = await balancesByAccount(scope.schoolId, [accountId]);
  return toDto(updated, balances.get(accountId));
}

/** Idempotent resolver for a stable system account (e.g. the generic cash-
 * receipt account) — upserts on the (schoolId, systemKey) unique constraint,
 * never matched by name. Used only by lib/server/accounting/fee-posting.ts. */
export async function ensureSystemAccount(tx: Prisma.TransactionClient, scope: OrgScope, systemKey: string, code: string, name: string, type: AccountingAccountTypeDto): Promise<string> {
  const row = await tx.accountingAccount.upsert({
    where: { schoolId_systemKey: { schoolId: scope.schoolId, systemKey } },
    create: { tenantId: scope.tenantId, schoolId: scope.schoolId, branchId: scope.branchId, code, name, type: TYPE_TO_DB[type] as never, systemKey },
    update: {},
    select: { id: true },
  });
  return row.id;
}
