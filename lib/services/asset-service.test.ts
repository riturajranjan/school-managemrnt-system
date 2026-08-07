import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { assignAsset, createAsset, disposeAsset, returnAsset } from "./asset-service";
import { moneyFromMajor } from "@/lib/finance/money";

const ACTOR = { name: "Asset Manager", role: "Inventory Manager" };

function makeAsset() {
  const r = createAsset(
    {
      branch: "main",
      assetTag: `AST-${Math.random().toString(36).slice(2, 8)}`,
      categoryId: "assetcat-1",
      type: "laptop",
      name: "Test Laptop",
      purchaseDate: "2024-08-05",
      cost: moneyFromMajor(50000, "INR"),
      location: "Store",
      condition: "good",
      usefulLifeYears: 4,
      salvageValue: moneyFromMajor(5000, "INR"),
      depreciationMethod: "straight-line",
      depreciationStartDate: "2024-08-05",
    },
    ACTOR,
  );
  if (!r.ok || !r.asset) throw new Error("asset create failed");
  return r.asset;
}

describe("assignAsset", () => {
  beforeEach(() => resetDemoData());

  it("assigns an available asset and flips its status", () => {
    const asset = makeAsset();
    const result = assignAsset({ assetId: asset.id, targetType: "teacher", targetName: "Meera" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().assets.find((a) => a.id === asset.id)?.status).toBe("assigned");
  });

  it("enforces assignment exclusivity", () => {
    const asset = makeAsset();
    assignAsset({ assetId: asset.id, targetType: "teacher", targetName: "Meera" }, ACTOR);
    const second = assignAsset({ assetId: asset.id, targetType: "teacher", targetName: "Ravi" }, ACTOR);
    expect(second.ok).toBe(false);
  });

  it("allows reassignment after return", () => {
    const asset = makeAsset();
    const first = assignAsset({ assetId: asset.id, targetType: "teacher", targetName: "Meera" }, ACTOR);
    if (!first.ok || !first.assignment) throw new Error("assign failed");
    returnAsset(first.assignment.id, ACTOR, "good");
    expect(getSnapshot().assets.find((a) => a.id === asset.id)?.status).toBe("available");
    const second = assignAsset({ assetId: asset.id, targetType: "department", targetName: "Science" }, ACTOR);
    expect(second.ok).toBe(true);
  });
});

describe("disposeAsset", () => {
  beforeEach(() => resetDemoData());

  it("blocks disposal while actively assigned", () => {
    const asset = makeAsset();
    assignAsset({ assetId: asset.id, targetType: "teacher", targetName: "Meera" }, ACTOR);
    const result = disposeAsset({ assetId: asset.id, reason: "end-of-life" }, ACTOR);
    expect(result.ok).toBe(false);
  });

  it("completes disposal with an approver and preserves history", () => {
    const asset = makeAsset();
    const result = disposeAsset({ assetId: asset.id, reason: "sold", disposalValue: moneyFromMajor(8000, "INR"), recipient: "Buyer", approvedBy: "Principal" }, ACTOR);
    expect(result.ok).toBe(true);
    const db = getSnapshot();
    expect(db.assets.find((a) => a.id === asset.id)?.status).toBe("disposed");
    expect(db.assetDisposals.some((d) => d.assetId === asset.id)).toBe(true);
  });
});
