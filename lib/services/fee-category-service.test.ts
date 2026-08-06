import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createFeeCategory, setFeeCategoryStatus } from "./fee-category-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

describe("fee-category-service", () => {
  beforeEach(() => resetDemoData());

  it("creates a non-built-in active category", () => {
    const category = createFeeCategory({ name: "Custom Fee", componentType: "custom" }, ACTOR);
    expect(category.builtIn).toBe(false);
    expect(category.status).toBe("active");
    expect(getSnapshot().feeCategories.some((c) => c.id === category.id)).toBe(true);
  });

  it("toggles a custom category's status", () => {
    const category = createFeeCategory({ name: "To Archive", componentType: "custom" }, ACTOR);
    const result = setFeeCategoryStatus(category.id, "inactive", ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().feeCategories.find((c) => c.id === category.id)?.status).toBe("inactive");
  });

  it("refuses to change a built-in category's status", () => {
    const db = getSnapshot();
    const builtIn = db.feeCategories.find((c) => c.builtIn);
    if (!builtIn) return;
    const result = setFeeCategoryStatus(builtIn.id, "inactive", ACTOR);
    expect(result.ok).toBe(false);
    expect(getSnapshot().feeCategories.find((c) => c.id === builtIn.id)?.status).toBe("active");
  });
});
