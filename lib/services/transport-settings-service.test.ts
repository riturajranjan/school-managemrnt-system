import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { updateShiftPolicy } from "./transport-settings-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

describe("updateShiftPolicy", () => {
  beforeEach(() => resetDemoData());

  it("updates the default pickup/drop times for a shift", () => {
    const result = updateShiftPolicy("morning", { defaultPickupTime: "06:30", defaultDropTime: "15:00" }, ACTOR);
    expect(result.ok).toBe(true);
    const policy = getSnapshot().transportShiftPolicies.find((p) => p.shift === "morning");
    expect(policy?.defaultPickupTime).toBe("06:30");
    expect(policy?.defaultDropTime).toBe("15:00");
  });

  it("leaves other shifts untouched", () => {
    updateShiftPolicy("morning", { defaultPickupTime: "06:30", defaultDropTime: "15:00" }, ACTOR);
    const afternoon = getSnapshot().transportShiftPolicies.find((p) => p.shift === "afternoon");
    expect(afternoon?.defaultPickupTime).toBe("12:00");
  });
});
