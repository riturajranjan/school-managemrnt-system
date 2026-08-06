import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createVendor, setVendorStatus, updateVendor } from "./vendor-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("vendor-service", () => {
  beforeEach(() => resetDemoData());

  it("creates an active vendor", () => {
    const vendor = createVendor({ name: "New Supplies Co.", categories: ["academic-materials"] }, ACTOR);
    expect(vendor.status).toBe("active");
    expect(getSnapshot().vendors.some((v) => v.id === vendor.id)).toBe(true);
  });

  it("updates vendor fields", () => {
    const vendor = createVendor({ name: "Old Name", categories: ["technology"] }, ACTOR);
    const result = updateVendor(vendor.id, { name: "New Name" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().vendors.find((v) => v.id === vendor.id)?.name).toBe("New Name");
  });

  it("marks a vendor inactive", () => {
    const vendor = createVendor({ name: "To Deactivate", categories: ["transport"] }, ACTOR);
    const result = setVendorStatus(vendor.id, "inactive", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().vendors.find((v) => v.id === vendor.id)?.status).toBe("inactive");
  });

  it("refuses to update a non-existent vendor", () => {
    const result = updateVendor("no-such-vendor", { name: "X" }, ACTOR);
    expect(result.ok).toBe(false);
  });
});
