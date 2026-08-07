import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { allocateBed, endAllocation, placeOrder, setBedStatus } from "./campus-service";
import { moneyFromMajor } from "@/lib/finance/money";

describe("hostel bed allocation integrity", () => {
  beforeEach(() => resetDemoData());

  function freeBed() {
    return getSnapshot().hostelBeds.find((b) => b.status === "available");
  }
  function unallocatedStudent() {
    const db = getSnapshot();
    const allocated = new Set(db.hostelAllocations.filter((a) => a.status === "active").map((a) => a.studentId));
    return db.students.find((s) => !allocated.has(s.id));
  }

  it("allocates a free bed to an unallocated student", () => {
    const bed = freeBed()!;
    const student = unallocatedStudent()!;
    const result = allocateBed({ studentId: student.id, bedId: bed.id });
    expect(result.ok).toBe(true);
    expect(getSnapshot().hostelBeds.find((b) => b.id === bed.id)?.status).toBe("occupied");
  });

  it("prevents double allocation of the same bed", () => {
    const bed = freeBed()!;
    const s1 = unallocatedStudent()!;
    allocateBed({ studentId: s1.id, bedId: bed.id });
    const s2 = unallocatedStudent()!;
    const result = allocateBed({ studentId: s2.id, bedId: bed.id });
    expect(result.ok).toBe(false);
  });

  it("prevents a duplicate active allocation for the same student", () => {
    const bed1 = freeBed()!;
    const student = unallocatedStudent()!;
    allocateBed({ studentId: student.id, bedId: bed1.id });
    const bed2 = getSnapshot().hostelBeds.find((b) => b.status === "available")!;
    const result = allocateBed({ studentId: student.id, bedId: bed2.id });
    expect(result.ok).toBe(false);
  });

  it("refuses allocation to a blocked bed", () => {
    const bed = freeBed()!;
    setBedStatus(bed.id, "blocked");
    const student = unallocatedStudent()!;
    const result = allocateBed({ studentId: student.id, bedId: bed.id });
    expect(result.ok).toBe(false);
  });

  it("frees the bed when an allocation ends", () => {
    const bed = freeBed()!;
    const student = unallocatedStudent()!;
    const result = allocateBed({ studentId: student.id, bedId: bed.id });
    if (!result.ok || !result.allocationId) throw new Error("alloc failed");
    endAllocation(result.allocationId);
    expect(getSnapshot().hostelBeds.find((b) => b.id === bed.id)?.status).toBe("available");
  });

  it("cannot block an occupied bed", () => {
    const bed = freeBed()!;
    const student = unallocatedStudent()!;
    allocateBed({ studentId: student.id, bedId: bed.id });
    expect(setBedStatus(bed.id, "blocked").ok).toBe(false);
  });
});

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
