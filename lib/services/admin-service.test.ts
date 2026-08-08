import { beforeEach, describe, expect, it } from "vitest";
import { getSnapshot, resetDemoData } from "@/lib/data/store";
import {
  changeUserRole,
  createBackup,
  moveModule,
  setSessionStatus,
  toggleCustomStatus,
  toggleModule,
  updateNumberingRule,
} from "./admin-service";
import { compareRoles, roleCan, systemReadiness } from "@/lib/selectors/admin-brief";

describe("academic session activation", () => {
  beforeEach(() => resetDemoData());

  it("activating a session closes the previously active one", () => {
    const upcoming = getSnapshot().admin.sessions.find((s) => s.status === "upcoming")!;
    setSessionStatus(upcoming.id, "active");
    const sessions = getSnapshot().admin.sessions;
    expect(sessions.filter((s) => s.status === "active")).toHaveLength(1);
    expect(sessions.find((s) => s.id === upcoming.id)!.status).toBe("active");
  });
});

describe("user role change is audited", () => {
  beforeEach(() => resetDemoData());

  it("records an audit entry with previous and new role", () => {
    const user = getSnapshot().admin.users.find((u) => u.role !== "principal")!;
    const before = getSnapshot().admin.auditLog.length;
    changeUserRole(user.id, "principal");
    const db = getSnapshot();
    expect(db.admin.users.find((u) => u.id === user.id)!.role).toBe("principal");
    expect(db.admin.auditLog.length).toBe(before + 1);
    expect(db.admin.auditLog[0].newValue).toBe("principal");
  });
});

describe("protected custom statuses", () => {
  beforeEach(() => resetDemoData());

  it("refuses to toggle a protected core status", () => {
    const protectedStatus = getSnapshot().admin.customStatuses.find((s) => s.isProtected)!;
    expect(toggleCustomStatus(protectedStatus.id).ok).toBe(false);
  });

  it("allows toggling a custom status", () => {
    const custom = getSnapshot().admin.customStatuses.find((s) => !s.isProtected)!;
    expect(toggleCustomStatus(custom.id).ok).toBe(true);
  });
});

describe("modules & numbering", () => {
  beforeEach(() => resetDemoData());

  it("toggles a module's enabled flag", () => {
    const m = getSnapshot().admin.modules[0];
    toggleModule(m.id);
    expect(getSnapshot().admin.modules.find((x) => x.id === m.id)!.enabled).toBe(!m.enabled);
  });

  it("reorders modules", () => {
    const mods = [...getSnapshot().admin.modules].sort((a, b) => a.order - b.order);
    const second = mods[1];
    moveModule(second.id, -1);
    const after = [...getSnapshot().admin.modules].sort((a, b) => a.order - b.order);
    expect(after[0].id).toBe(second.id);
  });

  it("rejects an invalid sequence length", () => {
    const rule = getSnapshot().admin.numbering[0];
    expect(updateNumberingRule(rule.id, { sequenceLength: 0 }).ok).toBe(false);
  });
});

describe("backups (simulation)", () => {
  beforeEach(() => resetDemoData());

  it("creates a manual backup and logs it", () => {
    const before = getSnapshot().admin.backups.length;
    const r = createBackup();
    expect(r.ok).toBe(true);
    expect(getSnapshot().admin.backups.length).toBe(before + 1);
  });
});

describe("permission matrix selectors (real rolePermissions)", () => {
  beforeEach(() => resetDemoData());

  it("super-admin can manage settings; student cannot", () => {
    expect(roleCan("super-admin", "settings", "manage")).toBe("yes");
    expect(roleCan("student", "settings", "manage")).toBe("no");
  });

  it("role comparison separates shared and role-specific capabilities", () => {
    const cmp = compareRoles("teacher", "principal");
    expect(cmp.shared.length).toBeGreaterThan(0);
    expect(cmp.onlyB.length).toBeGreaterThan(0);
  });

  it("system readiness returns a percentage and checks", () => {
    const r = systemReadiness(getSnapshot());
    expect(r.total).toBeGreaterThan(0);
    expect(r.percent).toBeGreaterThanOrEqual(0);
    expect(r.percent).toBeLessThanOrEqual(100);
  });
});
