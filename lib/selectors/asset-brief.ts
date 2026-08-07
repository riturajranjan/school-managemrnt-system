import type { Db } from "@/lib/data/store";
import { addMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { currentBookValue } from "./asset-depreciation";

export type AssetSummary = {
  total: number;
  assigned: number;
  available: number;
  underMaintenance: number;
  disposed: number;
  bookValue: Money;
  warrantyExpiringSoon: number;
  maintenanceDue: number;
};

export function assetSummary(db: Db, asOf = new Date().toISOString().slice(0, 10)): AssetSummary {
  const live = db.assets.filter((a) => a.status !== "disposed");
  const bookValue = live.reduce((sum, a) => addMoney(sum, currentBookValue(a, asOf)), zeroMoney("INR"));
  const soon = new Date(asOf);
  soon.setDate(soon.getDate() + 60);
  const soonIso = soon.toISOString().slice(0, 10);

  return {
    total: db.assets.length,
    assigned: db.assets.filter((a) => a.status === "assigned" || a.status === "in-use").length,
    available: db.assets.filter((a) => a.status === "available").length,
    underMaintenance: db.assets.filter((a) => a.status === "maintenance").length,
    disposed: db.assets.filter((a) => a.status === "disposed").length,
    bookValue,
    warrantyExpiringSoon: db.assets.filter((a) => a.warrantyExpiry && a.warrantyExpiry >= asOf && a.warrantyExpiry <= soonIso).length,
    maintenanceDue: db.assetMaintenance.filter((m) => m.status === "due" || m.status === "overdue").length,
  };
}
