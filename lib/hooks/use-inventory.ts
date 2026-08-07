"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";

export function useInventoryItems() {
  return useSisStore().inventoryItems;
}

export function useInventoryItem(itemId: string | undefined) {
  const db = useSisStore();
  return useMemo(() => db.inventoryItems.find((i) => i.id === itemId), [db.inventoryItems, itemId]);
}

export function useInventoryCategories() {
  return useSisStore().inventoryCategories;
}

export function useInventoryMovements(itemId?: string) {
  const db = useSisStore();
  return useMemo(() => (itemId ? db.inventoryMovements.filter((m) => m.itemId === itemId) : db.inventoryMovements), [db.inventoryMovements, itemId]);
}

export function useInventoryIssues() {
  return useSisStore().inventoryIssues;
}

export function useLowStockItems() {
  const db = useSisStore();
  return useMemo(() => db.inventoryItems.filter((i) => i.status === "low-stock" || i.status === "out-of-stock"), [db.inventoryItems]);
}
