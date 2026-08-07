import type { InventoryCategory, InventoryIssue, InventoryItem, InventoryMovement } from "@/lib/types/inventory";
import { moneyFromMajor } from "@/lib/finance/money";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(8082026);
export const BRANCH = "main";
const TODAY = "2026-08-05";

const categorySeed: { name: string; consumable: boolean }[] = [
  { name: "Stationery", consumable: true },
  { name: "Uniforms", consumable: false },
  { name: "Lab materials", consumable: true },
  { name: "Sports equipment", consumable: false },
  { name: "IT accessories", consumable: false },
  { name: "Cleaning supplies", consumable: true },
  { name: "Medical supplies", consumable: true },
  { name: "Office supplies", consumable: true },
];

export const inventoryCategories: InventoryCategory[] = categorySeed.map((c, i) => ({ id: `invcat-${i + 1}`, name: c.name, consumable: c.consumable, createdAt: TODAY }));

const itemSeed: { name: string; cat: number; unit: string; qty: number; min: number; reorder: number; max: number; cost: number }[] = [
  { name: "A4 Notebook", cat: 0, unit: "piece", qty: 420, min: 100, reorder: 150, max: 800, cost: 45 },
  { name: "Blue Ballpoint Pen", cat: 0, unit: "piece", qty: 60, min: 200, reorder: 300, max: 2000, cost: 8 },
  { name: "Chalk Box", cat: 0, unit: "box", qty: 90, min: 40, reorder: 60, max: 300, cost: 30 },
  { name: "Boys Uniform Shirt", cat: 1, unit: "piece", qty: 140, min: 50, reorder: 80, max: 400, cost: 320 },
  { name: "Girls Uniform Pinafore", cat: 1, unit: "piece", qty: 0, min: 40, reorder: 60, max: 300, cost: 360 },
  { name: "Litmus Paper Pack", cat: 2, unit: "pack", qty: 25, min: 20, reorder: 30, max: 120, cost: 55 },
  { name: "Test Tube", cat: 2, unit: "piece", qty: 300, min: 100, reorder: 150, max: 600, cost: 12 },
  { name: "Football", cat: 3, unit: "piece", qty: 18, min: 10, reorder: 15, max: 50, cost: 650 },
  { name: "Cricket Bat", cat: 3, unit: "piece", qty: 8, min: 6, reorder: 10, max: 30, cost: 900 },
  { name: "HDMI Cable", cat: 4, unit: "piece", qty: 22, min: 15, reorder: 20, max: 80, cost: 180 },
  { name: "Whiteboard Marker", cat: 0, unit: "piece", qty: 130, min: 80, reorder: 120, max: 500, cost: 25 },
  { name: "Phenyl 5L", cat: 5, unit: "bottle", qty: 40, min: 20, reorder: 30, max: 120, cost: 210 },
  { name: "First-Aid Bandage", cat: 6, unit: "pack", qty: 55, min: 30, reorder: 40, max: 150, cost: 35 },
  { name: "Printer A4 Paper Ream", cat: 7, unit: "ream", qty: 75, min: 40, reorder: 60, max: 250, cost: 260 },
];

function statusFor(qty: number, min: number, reorder: number): InventoryItem["status"] {
  if (qty === 0) return "out-of-stock";
  if (qty <= min) return "low-stock";
  if (qty <= reorder) return "low-stock";
  return "in-stock";
}

export const inventoryItems: InventoryItem[] = itemSeed.map((it, i) => ({
  id: `invitem-${i + 1}`,
  branch: BRANCH,
  name: it.name,
  sku: `SKU-${String(i + 1).padStart(4, "0")}`,
  categoryId: `invcat-${it.cat + 1}`,
  unit: it.unit,
  quantity: it.qty,
  minimumLevel: it.min,
  reorderLevel: it.reorder,
  maximumLevel: it.max,
  unitCost: moneyFromMajor(it.cost, "INR"),
  taxPercent: 18,
  storageLocation: helpers.pick(["Store Room A", "Store Room B", "Lab Store", "Sports Store"]),
  status: statusFor(it.qty, it.min, it.reorder),
  barcode: `INV${String(i + 1).padStart(5, "0")}`,
  createdAt: TODAY,
  updatedAt: TODAY,
}));

// Opening-stock movements — every item's initial quantity is backed by a
// receipt so the ledger is the single source of truth from day one.
export const inventoryMovements: InventoryMovement[] = inventoryItems.map((item, i) => ({
  id: `invmov-${i + 1}`,
  itemId: item.id,
  type: "receipt",
  quantityDelta: item.quantity,
  balanceAfter: item.quantity,
  unitCost: item.unitCost,
  reference: "Opening stock",
  actorName: "System",
  createdAt: TODAY,
}));

export const inventoryIssues: InventoryIssue[] = [
  { id: "invissue-1", itemId: "invitem-1", quantity: 30, returnedQuantity: 0, recipientType: "classroom", recipientName: "Class VI-A", purpose: "Notebooks for term", issueDate: helpers.daysAgoIso(10).slice(0, 10), returnable: false, status: "consumed", approvedBy: "Storekeeper", createdAt: TODAY, updatedAt: TODAY },
  { id: "invissue-2", itemId: "invitem-8", quantity: 4, returnedQuantity: 0, recipientType: "department", recipientName: "Physical Education", purpose: "Sports period", issueDate: helpers.daysAgoIso(5).slice(0, 10), expectedReturn: helpers.daysFromNowIso(2).slice(0, 10), returnable: true, status: "issued", approvedBy: "Storekeeper", createdAt: TODAY, updatedAt: TODAY },
];
