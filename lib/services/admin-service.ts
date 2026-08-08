import { getSnapshot, setState } from "@/lib/data/store";
import type {
  AdminState,
  AuditLogEntry,
  BackupMock,
  BrandingSettings,
  CommunicationSetting,
  CustomFieldDefinition,
  FeatureState,
  LocalizationSettings,
  NotificationChannel,
  RegionalSettings,
  SchoolProfile,
  SystemUserStatus,
  ThemeSettings,
  WorkflowStep,
} from "@/lib/types/admin";
import type { UserRole } from "@/lib/permissions/roles";
import { generateId } from "@/lib/utils";

type Result = { ok: true } | { ok: false; error: string };

/** Replaces part of the grouped admin state. Internal helper. */
function patchAdmin(updater: (a: AdminState) => AdminState) {
  setState((db) => ({ ...db, admin: updater(db.admin) }));
}

function logAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">) {
  patchAdmin((a) => ({ ...a, auditLog: [{ id: generateId("al"), timestamp: new Date().toISOString(), ...entry }, ...a.auditLog] }));
}

// ---------------------------------------------------------------------------
// Organization settings
// ---------------------------------------------------------------------------

export function saveSchoolProfile(profile: SchoolProfile): Result {
  if (!profile.name.trim()) return { ok: false, error: "School name is required." };
  patchAdmin((a) => ({ ...a, schoolProfile: profile }));
  return { ok: true };
}

export function setSessionStatus(sessionId: string, status: AdminState["sessions"][number]["status"]): Result {
  const db = getSnapshot();
  if (status === "active") {
    // Only one active session — deactivate the current active one.
    patchAdmin((a) => ({ ...a, sessions: a.sessions.map((s) => (s.id === sessionId ? { ...s, status: "active" } : s.status === "active" ? { ...s, status: "closed" } : s)) }));
    logAudit({ actor: "Administrator", role: "administrator", module: "Settings", action: "Session activated", record: sessionId, branch: "All branches", status: "success" });
    return { ok: true };
  }
  patchAdmin((a) => ({ ...a, sessions: a.sessions.map((s) => (s.id === sessionId ? { ...s, status } : s)) }));
  void db;
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Users & roles
// ---------------------------------------------------------------------------

export function setUserStatus(userId: string, status: SystemUserStatus): Result {
  patchAdmin((a) => ({ ...a, users: a.users.map((u) => (u.id === userId ? { ...u, status } : u)) }));
  logAudit({ actor: "Administrator", role: "administrator", module: "Settings", action: `User ${status}`, record: userId, branch: "All branches", status: "success" });
  return { ok: true };
}

export function changeUserRole(userId: string, role: UserRole): Result {
  const db = getSnapshot();
  const user = db.admin.users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: "User not found." };
  patchAdmin((a) => ({ ...a, users: a.users.map((u) => (u.id === userId ? { ...u, role } : u)) }));
  logAudit({ actor: "Administrator", role: "administrator", module: "Settings", action: "Role changed", record: user.name, branch: user.branch, status: "success", previousValue: user.role, newValue: role });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Workflows
// ---------------------------------------------------------------------------

export function addWorkflowStep(workflowId: string, role: UserRole, label: string): Result {
  patchAdmin((a) => ({ ...a, workflows: a.workflows.map((w) => (w.id === workflowId ? { ...w, steps: [...w.steps, { id: generateId("wfs"), order: w.steps.length, role, label, required: true }] } : w)) }));
  return { ok: true };
}

export function removeWorkflowStep(workflowId: string, stepId: string): Result {
  patchAdmin((a) => ({ ...a, workflows: a.workflows.map((w) => (w.id === workflowId ? { ...w, steps: w.steps.filter((s) => s.id !== stepId).map((s, i) => ({ ...s, order: i })) } : w)) }));
  return { ok: true };
}

export function moveWorkflowStep(workflowId: string, stepId: string, dir: -1 | 1): Result {
  patchAdmin((a) => ({
    ...a,
    workflows: a.workflows.map((w) => {
      if (w.id !== workflowId) return w;
      const steps = [...w.steps].sort((x, y) => x.order - y.order);
      const i = steps.findIndex((s) => s.id === stepId);
      const j = i + dir;
      if (j < 0 || j >= steps.length) return w;
      [steps[i].order, steps[j].order] = [steps[j].order, steps[i].order];
      return { ...w, steps };
    }),
  }));
  return { ok: true };
}

export function updateWorkflowStep(workflowId: string, stepId: string, patch: Partial<WorkflowStep>): Result {
  patchAdmin((a) => ({ ...a, workflows: a.workflows.map((w) => (w.id === workflowId ? { ...w, steps: w.steps.map((s) => (s.id === stepId ? { ...s, ...patch } : s)) } : w)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Custom fields & statuses
// ---------------------------------------------------------------------------

export function toggleCustomField(fieldId: string): Result {
  patchAdmin((a) => ({ ...a, customFields: a.customFields.map((f) => (f.id === fieldId ? { ...f, status: f.status === "active" ? "inactive" : "active" } : f)) }));
  return { ok: true };
}

export function addCustomField(field: Omit<CustomFieldDefinition, "id" | "order">): Result {
  if (!field.label.trim()) return { ok: false, error: "Field label is required." };
  patchAdmin((a) => ({ ...a, customFields: [...a.customFields, { ...field, id: generateId("cf"), order: a.customFields.length }] }));
  return { ok: true };
}

export function toggleCustomStatus(statusId: string): Result {
  const db = getSnapshot();
  const st = db.admin.customStatuses.find((s) => s.id === statusId);
  if (!st) return { ok: false, error: "Status not found." };
  if (st.isProtected) return { ok: false, error: "Core protected statuses cannot be modified in the simulation." };
  patchAdmin((a) => ({ ...a, customStatuses: a.customStatuses.map((s) => (s.id === statusId ? { ...s, active: !s.active } : s)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Branding, theme, localization, regional, communication
// ---------------------------------------------------------------------------

export function saveBranding(branding: BrandingSettings): Result {
  patchAdmin((a) => ({ ...a, branding }));
  return { ok: true };
}
export function saveTheme(theme: ThemeSettings): Result {
  patchAdmin((a) => ({ ...a, theme }));
  return { ok: true };
}
export function saveLocalization(localization: LocalizationSettings): Result {
  if (!localization.enabledLanguages.some((l) => l.enabled)) return { ok: false, error: "At least one language must be enabled." };
  patchAdmin((a) => ({ ...a, localization }));
  return { ok: true };
}
export function saveRegional(regional: RegionalSettings): Result {
  patchAdmin((a) => ({ ...a, regional }));
  return { ok: true };
}
export function saveCommunication(comm: CommunicationSetting): Result {
  patchAdmin((a) => ({ ...a, communication: comm }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Numbering
// ---------------------------------------------------------------------------

export function updateNumberingRule(ruleId: string, patch: Partial<AdminState["numbering"][number]>): Result {
  if (patch.sequenceLength != null && patch.sequenceLength < 1) return { ok: false, error: "Sequence length must be at least 1." };
  patchAdmin((a) => ({ ...a, numbering: a.numbering.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Notifications, modules, features
// ---------------------------------------------------------------------------

export function toggleNotification(module: string, channel: NotificationChannel): Result {
  patchAdmin((a) => ({ ...a, notifications: a.notifications.map((n) => (n.module === module ? { ...n, channels: { ...n.channels, [channel]: !n.channels[channel] } } : n)) }));
  return { ok: true };
}

export function toggleModule(moduleId: string): Result {
  patchAdmin((a) => ({ ...a, modules: a.modules.map((m) => (m.id === moduleId ? { ...m, enabled: !m.enabled } : m)) }));
  return { ok: true };
}

export function setModuleVisibility(moduleId: string, visibility: AdminState["modules"][number]["roleVisibility"]): Result {
  patchAdmin((a) => ({ ...a, modules: a.modules.map((m) => (m.id === moduleId ? { ...m, roleVisibility: visibility } : m)) }));
  return { ok: true };
}

export function moveModule(moduleId: string, dir: -1 | 1): Result {
  patchAdmin((a) => {
    const mods = [...a.modules].sort((x, y) => x.order - y.order);
    const i = mods.findIndex((m) => m.id === moduleId);
    const j = i + dir;
    if (j < 0 || j >= mods.length) return a;
    [mods[i].order, mods[j].order] = [mods[j].order, mods[i].order];
    return { ...a, modules: mods };
  });
  return { ok: true };
}

export function setFeatureState(featureId: string, state: FeatureState): Result {
  patchAdmin((a) => ({ ...a, features: a.features.map((f) => (f.id === featureId ? { ...f, state } : f)) }));
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Security, backups, exports (simulations)
// ---------------------------------------------------------------------------

export function toggleSecuritySetting(key: string): Result {
  patchAdmin((a) => ({ ...a, security: a.security.map((s) => (s.key === key ? { ...s, enabled: !s.enabled } : s)) }));
  return { ok: true };
}

export function createBackup(): Result & { backupId?: string } {
  const backup: BackupMock = { id: generateId("bk"), label: "Manual backup", sizeMb: 150, createdAt: new Date().toISOString(), type: "manual", status: "available" };
  patchAdmin((a) => ({ ...a, backups: [backup, ...a.backups] }));
  logAudit({ actor: "Administrator", role: "administrator", module: "Settings", action: "Backup created (simulation)", record: backup.id, branch: "All branches", status: "success" });
  return { ok: true, backupId: backup.id };
}

export function startExport(module: string, format: "csv" | "xlsx" | "pdf", rows: number): Result {
  patchAdmin((a) => ({ ...a, exports: [{ id: generateId("ex"), module, format, rows, status: "completed", createdAt: new Date().toISOString() }, ...a.exports] }));
  return { ok: true };
}
