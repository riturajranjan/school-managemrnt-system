import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { publishAnnouncement } from "./saas-service";

// This mock-store suite now covers only the SHRINKING remainder that still backs
// the not-yet-migrated Announcements page. Everything else went real and is
// covered by DB-integration tests:
//   • createTenant → SA-3 (schools-service)
//   • changePlan/setSubscriptionStatus → SA-4B, extendTrial → SA-4C
//   • setInvoiceStatus → SA-4D, payments → SA-4E
//   • setTenantStatus/addTenantNote + setEntitlementOverride/clearEntitlementOverride → SA-4L
//   • toggleMarketplaceItem → SA-4M (marketplace-service). Its `db.saas.addons`/
//     `db.saas.marketplace` slices were deleted.

describe("announcements", () => {
  beforeEach(() => resetDemoData());

  it("publishes a new announcement to the top of the list", () => {
    const before = getSnapshot().saas.announcements.length;
    const res = publishAnnouncement({ title: "Term 2 opens", type: "product-update", audience: "All schools", body: "Details soon." });
    expect(res.ok).toBe(true);
    const list = getSnapshot().saas.announcements;
    expect(list.length).toBe(before + 1);
    expect(list[0].title).toBe("Term 2 opens");
    expect(list[0].status).toBe("published");
  });

  it("rejects an empty title", () => {
    const res = publishAnnouncement({ title: "   ", type: "policy", audience: "All", body: "x" });
    expect(res.ok).toBe(false);
  });
});
