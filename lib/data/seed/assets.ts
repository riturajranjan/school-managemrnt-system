import type { Asset, AssetAssignment, AssetCategory, AssetMaintenance, AssetType, DepreciationMethod } from "@/lib/types/assets";
import { moneyFromMajor, zeroMoney } from "@/lib/finance/money";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(9082026);
export const BRANCH = "main";
const TODAY = "2026-08-05";

const categorySeed: { name: string; life: number; method: DepreciationMethod }[] = [
  { name: "IT Equipment", life: 4, method: "declining-balance" },
  { name: "AV Equipment", life: 5, method: "straight-line" },
  { name: "Furniture", life: 10, method: "straight-line" },
  { name: "Lab Equipment", life: 7, method: "straight-line" },
  { name: "Sports Equipment", life: 5, method: "straight-line" },
  { name: "Facilities", life: 8, method: "declining-balance" },
];

export const assetCategories: AssetCategory[] = categorySeed.map((c, i) => ({ id: `assetcat-${i + 1}`, name: c.name, defaultUsefulLifeYears: c.life, defaultDepreciationMethod: c.method, createdAt: TODAY }));

const assetSeed: { name: string; type: AssetType; cat: number; cost: number; loc: string }[] = [
  { name: "Dell Latitude Laptop", type: "laptop", cat: 0, cost: 55000, loc: "Staff Room" },
  { name: "HP Desktop PC", type: "desktop", cat: 0, cost: 42000, loc: "Computer Lab" },
  { name: "Epson Projector", type: "projector", cat: 1, cost: 38000, loc: "Room 201" },
  { name: "Smart Board 65\"", type: "smartboard", cat: 1, cost: 120000, loc: "Room 105" },
  { name: "Canon Laser Printer", type: "printer", cat: 0, cost: 18000, loc: "Office" },
  { name: "Student Desk (set)", type: "furniture", cat: 2, cost: 4500, loc: "Room 105" },
  { name: "Microscope", type: "lab-equipment", cat: 3, cost: 25000, loc: "Biology Lab" },
  { name: "CCTV Camera Dome", type: "cctv", cat: 5, cost: 9000, loc: "Corridor A" },
  { name: "Network Switch 24-port", type: "network-equipment", cat: 0, cost: 15000, loc: "Server Room" },
  { name: "Diesel Generator 25kVA", type: "generator", cat: 5, cost: 280000, loc: "Utility Block" },
  { name: "Split Air Conditioner 1.5T", type: "air-conditioner", cat: 5, cost: 42000, loc: "Principal Office" },
  { name: "Treadmill", type: "sports-equipment", cat: 4, cost: 60000, loc: "Fitness Room" },
];

const statuses = ["available", "assigned", "in-use", "maintenance"] as const;

export const assets: Asset[] = assetSeed.map((a, i) => {
  const category = assetCategories[a.cat];
  const purchaseYearsAgo = helpers.int(0, 4);
  const purchaseDate = helpers.daysAgoIso(purchaseYearsAgo * 365 + helpers.int(0, 200)).slice(0, 10);
  const status = helpers.pick(statuses);
  return {
    id: `asset-${i + 1}`,
    branch: BRANCH,
    assetTag: `AST-${String(i + 1).padStart(4, "0")}`,
    barcode: `AST${String(i + 1).padStart(5, "0")}`,
    qrToken: `aqr_${helpers.int(100000, 999999)}${i}`,
    categoryId: category.id,
    type: a.type,
    name: a.name,
    brand: helpers.pick(["Dell", "HP", "Canon", "Epson", "Generic", "Godrej"]),
    model: `M-${helpers.int(100, 999)}`,
    serialNumber: `SN${helpers.int(100000, 999999)}`,
    purchaseDate,
    cost: moneyFromMajor(a.cost, "INR"),
    warrantyExpiry: helpers.bool(0.6) ? helpers.daysFromNowIso(helpers.int(-120, 400)).slice(0, 10) : undefined,
    location: a.loc,
    department: helpers.pick(["Academics", "Administration", "IT", "Science", "Sports"]),
    condition: helpers.pick(["excellent", "good", "good", "fair"] as const),
    status,
    usefulLifeYears: category.defaultUsefulLifeYears,
    salvageValue: moneyFromMajor(Math.round(a.cost * 0.1), "INR"),
    depreciationMethod: category.defaultDepreciationMethod,
    depreciationStartDate: purchaseDate,
    accumulatedDepreciation: zeroMoney("INR"),
    createdAt: TODAY,
    updatedAt: TODAY,
  } satisfies Asset;
});

export const assetAssignments: AssetAssignment[] = assets
  .filter((a) => a.status === "assigned" || a.status === "in-use")
  .map((a, i) => ({
    id: `assetassign-${i + 1}`,
    assetId: a.id,
    targetType: helpers.pick(["teacher", "department", "classroom", "office"] as const),
    targetName: helpers.pick(["Meera Krishnan", "Science Department", "Room 105", "Principal Office"]),
    assignedAt: helpers.daysAgoIso(helpers.int(20, 200)),
    conditionAtIssue: a.condition,
    acknowledged: helpers.bool(0.8),
    status: "active",
    assignedBy: "Asset Manager",
    createdAt: TODAY,
    updatedAt: TODAY,
  }));

export const assetMaintenance: AssetMaintenance[] = assets
  .filter((_, i) => i % 3 === 0)
  .map((a, i) => ({
    id: `assetmaint-${i + 1}`,
    assetId: a.id,
    type: helpers.pick(["preventive", "repair", "inspection"] as const),
    status: a.status === "maintenance" ? "in-progress" : helpers.pick(["due", "completed"] as const),
    scheduledDate: helpers.daysFromNowIso(helpers.int(-30, 45)).slice(0, 10),
    cost: helpers.bool(0.5) ? moneyFromMajor(helpers.int(500, 5000), "INR") : undefined,
    nextServiceDate: helpers.daysFromNowIso(helpers.int(60, 180)).slice(0, 10),
    createdAt: TODAY,
    updatedAt: TODAY,
  }));
