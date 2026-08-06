import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import { createReminderRule, deleteReminderRule, previewTemplate, setReminderRuleStatus, updateReminderRule, type ReminderRuleDraft } from "./reminder-rule-service";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

function draft(overrides: Partial<ReminderRuleDraft> = {}): ReminderRuleDraft {
  return {
    name: "Test rule",
    trigger: "before-due",
    offsetDays: 5,
    channels: ["sms"],
    audience: "parent",
    templateEn: "Reminder: {studentName} owes {amount}, due {dueDate}.",
    maxReminders: 1,
    ...overrides,
  };
}

describe("createReminderRule / updateReminderRule / setReminderRuleStatus / deleteReminderRule", () => {
  beforeEach(() => resetDemoData());

  it("creates an active rule", () => {
    const rule = createReminderRule(draft(), ACTOR);
    expect(rule.status).toBe("active");
    expect(getSnapshot().reminderRules.some((r) => r.id === rule.id)).toBe(true);
  });

  it("updates only the targeted rule", () => {
    const rule = createReminderRule(draft(), ACTOR);
    const other = createReminderRule(draft({ name: "Other rule" }), ACTOR);
    updateReminderRule(rule.id, { name: "Renamed" }, ACTOR);
    const after = getSnapshot();
    expect(after.reminderRules.find((r) => r.id === rule.id)?.name).toBe("Renamed");
    expect(after.reminderRules.find((r) => r.id === other.id)?.name).toBe("Other rule");
  });

  it("toggles a rule's status", () => {
    const rule = createReminderRule(draft(), ACTOR);
    setReminderRuleStatus(rule.id, "inactive", ACTOR);
    expect(getSnapshot().reminderRules.find((r) => r.id === rule.id)?.status).toBe("inactive");
  });

  it("deletes a rule", () => {
    const rule = createReminderRule(draft(), ACTOR);
    deleteReminderRule(rule.id, ACTOR);
    expect(getSnapshot().reminderRules.some((r) => r.id === rule.id)).toBe(false);
  });
});

describe("previewTemplate", () => {
  it("substitutes every placeholder with the sample values", () => {
    const rendered = previewTemplate("Dear parent, {studentName}'s fee of {amount} is due on {dueDate}.", { studentName: "Aarav Mehta", amount: "₹5,000", dueDate: "15 Sep 2026" });
    expect(rendered).toBe("Dear parent, Aarav Mehta's fee of ₹5,000 is due on 15 Sep 2026.");
  });

  it("leaves the template unchanged when it has no placeholders", () => {
    expect(previewTemplate("A generic message.", { studentName: "X", amount: "Y", dueDate: "Z" })).toBe("A generic message.");
  });
});
