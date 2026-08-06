import { getSnapshot, setState } from "@/lib/data/store";
import type { ChartOfAccount, ChartOfAccountType } from "@/lib/types/accounting";
import { zeroMoney } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export type ChartOfAccountDraft = { code: string; name: string; type: ChartOfAccountType; description?: string };

export function createChartOfAccount(input: ChartOfAccountDraft, actor: Actor): ChartOfAccount {
  const account: ChartOfAccount = { id: generateId("coa"), code: input.code, name: input.name, type: input.type, description: input.description, openingBalance: zeroMoney("INR"), currency: "INR", branch: "main", status: "active" };
  setState((db) => ({ ...db, chartOfAccounts: [...db.chartOfAccounts, account] }));
  logFinancialAudit({ action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Chart of accounts entry "${account.name}" (${account.code}) created.` });
  return account;
}

export function setChartOfAccountStatus(accountId: string, status: ChartOfAccount["status"], actor: Actor): { ok: true } | { ok: false; error: string } {
  const db = getSnapshot();
  const account = db.chartOfAccounts.find((a) => a.id === accountId);
  if (!account) return { ok: false, error: "Account not found." };
  setState((current) => ({ ...current, chartOfAccounts: current.chartOfAccounts.map((a) => (a.id === accountId ? { ...a, status } : a)) }));
  logFinancialAudit({ action: "journal-posted", actorName: actor.name, actorRole: actor.role, summary: `Account "${account.name}" marked ${status}.` });
  return { ok: true };
}
