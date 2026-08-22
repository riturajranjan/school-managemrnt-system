import { beforeEach, describe, expect, it } from "vitest";
import { resetDemoData } from "@/lib/data/store";
import { placeOrder } from "./campus-service";
import { moneyFromMajor } from "@/lib/finance/money";

// Hostel bed-allocation integrity tests moved to lib/server/hostel/hostel.db.test.ts
// (Phase 9Q) — allocateBed/endAllocation/setBedStatus/markHostelAttendance were
// deleted here as dead mock authority with zero remaining consumers.

describe("cafeteria order", () => {
  beforeEach(() => resetDemoData());

  it("places an order and computes the total", () => {
    const result = placeOrder({
      studentName: "Test Student",
      items: [
        { menuItemId: "mi-1", name: "Masala Dosa", quantity: 2, price: moneyFromMajor(45, "INR") },
        { menuItemId: "mi-4", name: "Veg Thali", quantity: 1, price: moneyFromMajor(80, "INR") },
      ],
      counter: "Main",
      pickupTime: "13:00",
    });
    expect(result.ok).toBe(true);
    if (!result.ok || !result.order) return;
    expect(result.order.total.minorUnits).toBe(17000); // (45*2 + 80) * 100
    expect(result.order.status).toBe("placed");
  });

  it("refuses an empty order", () => {
    expect(placeOrder({ studentName: "X", items: [], counter: "Main", pickupTime: "13:00" }).ok).toBe(false);
  });
});
