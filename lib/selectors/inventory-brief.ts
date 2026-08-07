import type { Db } from "@/lib/data/store";
import { addMoney, multiplyMoney, zeroMoney, type Money } from "@/lib/finance/money";

export type InventorySummary = {
  totalItems: number;
  stockValue: Money;
  lowStock: number;
  outOfStock: number;
  pendingIssues: number;
  reorderNeeded: number;
  categories: number;
  damagedOrExpired: number;
};

export function inventorySummary(db: Db): InventorySummary {
  const stockValue = db.inventoryItems.reduce((sum, i) => addMoney(sum, multiplyMoney(i.unitCost, i.quantity)), zeroMoney("INR"));
  return {
    totalItems: db.inventoryItems.length,
    stockValue,
    lowStock: db.inventoryItems.filter((i) => i.status === "low-stock").length,
    outOfStock: db.inventoryItems.filter((i) => i.status === "out-of-stock").length,
    pendingIssues: db.inventoryIssues.filter((i) => i.status === "issued" || i.status === "partially-returned").length,
    reorderNeeded: db.inventoryItems.filter((i) => i.quantity <= i.reorderLevel).length,
    categories: db.inventoryCategories.length,
    damagedOrExpired: db.inventoryItems.filter((i) => i.status === "damaged" || i.status === "expired").length,
  };
}
