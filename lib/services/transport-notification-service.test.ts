import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createNotificationRule, dispatchRuleNotification, previewNotificationTemplate, sendTransportNotification, setNotificationRuleStatus, updateNotificationRule } from "./transport-notification-service";

const ACTOR = { name: "Transport Administrator", role: "Transport Administrator" };

describe("previewNotificationTemplate", () => {
  it("substitutes every placeholder with the sample values", () => {
    const rendered = previewNotificationTemplate("{studentName} boarded at {stopName}.", { studentName: "Aarav Mehta", stopName: "Indiranagar" });
    expect(rendered).toBe("Aarav Mehta boarded at Indiranagar.");
  });

  it("leaves unmatched placeholders untouched", () => {
    const rendered = previewNotificationTemplate("{studentName} is at {stopName}.", { studentName: "Aarav" });
    expect(rendered).toBe("Aarav is at {stopName}.");
  });
});

describe("createNotificationRule / updateNotificationRule / setNotificationRuleStatus", () => {
  beforeEach(() => resetDemoData());

  it("creates an active rule", () => {
    const rule = createNotificationRule({ name: "Test rule", trigger: "delay", channels: ["push"], audience: "parent", templateEn: "{routeName} is delayed." }, ACTOR);
    expect(rule.status).toBe("active");
    expect(getSnapshot().transportNotificationRules.some((r) => r.id === rule.id)).toBe(true);
  });

  it("updates a rule's template", () => {
    const rule = createNotificationRule({ name: "Test rule", trigger: "delay", channels: ["push"], audience: "parent", templateEn: "Old template" }, ACTOR);
    const result = updateNotificationRule(rule.id, { templateEn: "New template" }, ACTOR);
    expect(result.ok).toBe(true);
    expect(getSnapshot().transportNotificationRules.find((r) => r.id === rule.id)?.templateEn).toBe("New template");
  });

  it("deactivates a rule", () => {
    const rule = createNotificationRule({ name: "Test rule", trigger: "delay", channels: ["push"], audience: "parent", templateEn: "Template" }, ACTOR);
    expect(setNotificationRuleStatus(rule.id, "inactive", ACTOR).ok).toBe(true);
    expect(getSnapshot().transportNotificationRules.find((r) => r.id === rule.id)?.status).toBe("inactive");
  });
});

describe("sendTransportNotification / dispatchRuleNotification", () => {
  beforeEach(() => resetDemoData());

  it("writes a sent notification record", () => {
    const before = getSnapshot().transportNotifications.length;
    sendTransportNotification({ trigger: "bus-departed", channel: "push", audience: "parent", recipientId: "student-1", message: "Bus departed." }, ACTOR);
    expect(getSnapshot().transportNotifications.length).toBe(before + 1);
  });

  it("dispatches one notification per configured channel on the rule", () => {
    const rule = createNotificationRule({ name: "Multi-channel", trigger: "delay", channels: ["push", "sms", "whatsapp"], audience: "parent", templateEn: "{routeName} delayed." }, ACTOR);
    const before = getSnapshot().transportNotifications.length;
    const sent = dispatchRuleNotification(rule, "student-1", { routeName: "Route 1" }, ACTOR);
    expect(sent).toHaveLength(3);
    expect(getSnapshot().transportNotifications.length).toBe(before + 3);
    expect(sent.every((n) => n.message === "Route 1 delayed.")).toBe(true);
  });
});
