import { setState } from "@/lib/data/store";
import type { FeeCategory, FeeComponentType } from "@/lib/types/fees";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

type Actor = { name: string; role: string };

export function createFeeCategory(data: { name: string; description?: string; componentType: FeeComponentType }, actor: Actor): FeeCategory {
  const category: FeeCategory = { id: generateId("cat"), ...data, builtIn: false, status: "active", createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, feeCategories: [...db.feeCategories, category] }));
  logFinancialAudit({ action: "fee-category-created", actorName: actor.name, actorRole: actor.role, summary: `Fee category "${category.name}" created.` });
  return category;
}

export type SetFeeCategoryStatusResult = { ok: true } | { ok: false; error: string };

export function setFeeCategoryStatus(categoryId: string, status: FeeCategory["status"], actor: Actor): SetFeeCategoryStatusResult {
  let found = false;
  let name = "";
  setState((db) => {
    const category = db.feeCategories.find((c) => c.id === categoryId);
    if (!category || category.builtIn) return db;
    found = true;
    name = category.name;
    return { ...db, feeCategories: db.feeCategories.map((c) => (c.id === categoryId ? { ...c, status } : c)) };
  });
  if (!found) return { ok: false, error: "Category not found or cannot be modified." };
  logFinancialAudit({ action: "fee-category-updated", actorName: actor.name, actorRole: actor.role, summary: `Fee category "${name}" marked ${status}.` });
  return { ok: true };
}
