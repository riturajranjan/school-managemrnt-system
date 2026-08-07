import { getSnapshot, setState } from "@/lib/data/store";
import type { Asset, AssetAssignment, AssetCondition, AssetDisposal, AssetMaintenance, AssignmentTargetType, DisposalReason, MaintenanceType } from "@/lib/types/assets";
import { accumulatedDepreciation, currentBookValue, periodsElapsed } from "@/lib/selectors/asset-depreciation";
import type { Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export type AssetDraft = Omit<Asset, "id" | "barcode" | "qrToken" | "status" | "accumulatedDepreciation" | "createdAt" | "updatedAt">;

let tagCounter = 0;

export function createAsset(draft: AssetDraft, actor: Actor): Result & { asset?: Asset } {
  const db = getSnapshot();
  if (db.assets.some((a) => a.assetTag.toLowerCase() === draft.assetTag.trim().toLowerCase())) return { ok: false, error: `Asset tag "${draft.assetTag}" is already in use.` };
  const now = new Date().toISOString();
  tagCounter += 1;
  const asset: Asset = { ...draft, id: generateId("asset"), barcode: `AST${Date.now().toString(36).toUpperCase()}${tagCounter}`, qrToken: `aqr_${generateId("t").slice(2)}`, status: "available", accumulatedDepreciation: accumulatedDepreciation(draft.cost, draft.salvageValue, draft.usefulLifeYears, draft.depreciationMethod, periodsElapsed(draft.depreciationStartDate, now.slice(0, 10))), createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, assets: [...current.assets, asset] }));
  logResourceAudit({ domain: "asset", subjectId: asset.id, action: "asset-created", actorName: actor.name, actorRole: actor.role, summary: `Asset "${asset.name}" (${asset.assetTag}) registered.` });
  return { ok: true, asset };
}

/** Assigns an asset to a target. Enforces exclusivity — an asset that is already
 * actively assigned cannot be assigned again until returned. */
export function assignAsset(input: { assetId: string; targetType: AssignmentTargetType; targetName: string; targetId?: string; expectedReturn?: string; notes?: string }, actor: Actor): Result & { assignment?: AssetAssignment } {
  const db = getSnapshot();
  const asset = db.assets.find((a) => a.id === input.assetId);
  if (!asset) return { ok: false, error: "Asset not found." };
  if (asset.status === "disposed" || asset.status === "retired" || asset.status === "lost") return { ok: false, error: `Asset is ${asset.status} and cannot be assigned.` };
  const activeAssignment = db.assetAssignments.find((a) => a.assetId === input.assetId && a.status === "active");
  if (activeAssignment) return { ok: false, error: "Asset is already assigned. Return it before reassigning." };

  const now = new Date().toISOString();
  const assignment: AssetAssignment = { id: generateId("assetassign"), assetId: input.assetId, targetType: input.targetType, targetId: input.targetId, targetName: input.targetName, assignedAt: now, expectedReturn: input.expectedReturn, conditionAtIssue: asset.condition, acknowledged: false, status: "active", assignedBy: actor.name, notes: input.notes, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, assetAssignments: [assignment, ...current.assetAssignments], assets: current.assets.map((a) => (a.id === input.assetId ? { ...a, status: "assigned", assignedToId: input.targetId, assignedToName: input.targetName, department: input.targetType === "department" ? input.targetName : a.department, updatedAt: now } : a)) }));
  logResourceAudit({ domain: "asset", subjectId: input.assetId, action: "asset-assigned", actorName: actor.name, actorRole: actor.role, summary: `"${asset.name}" assigned to ${input.targetName}.` });
  return { ok: true, assignment };
}

export function returnAsset(assignmentId: string, actor: Actor, conditionAtReturn: AssetCondition): Result {
  const db = getSnapshot();
  const assignment = db.assetAssignments.find((a) => a.id === assignmentId);
  if (!assignment) return { ok: false, error: "Assignment not found." };
  if (assignment.status !== "active") return { ok: false, error: "This assignment is not active." };
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    assetAssignments: current.assetAssignments.map((a) => (a.id === assignmentId ? { ...a, status: "returned", returnedAt: now, conditionAtReturn, updatedAt: now } : a)),
    assets: current.assets.map((a) => (a.id === assignment.assetId ? { ...a, status: "available", assignedToId: undefined, assignedToName: undefined, condition: conditionAtReturn, updatedAt: now } : a)),
  }));
  logResourceAudit({ domain: "asset", subjectId: assignment.assetId, action: "asset-returned", actorName: actor.name, actorRole: actor.role, summary: `Asset returned from ${assignment.targetName} in ${conditionAtReturn} condition.` });
  return { ok: true };
}

export function scheduleMaintenance(input: { assetId: string; type: MaintenanceType; scheduledDate: string; notes?: string }, actor: Actor): Result & { maintenance?: AssetMaintenance } {
  const db = getSnapshot();
  const asset = db.assets.find((a) => a.id === input.assetId);
  if (!asset) return { ok: false, error: "Asset not found." };
  const now = new Date().toISOString();
  const maintenance: AssetMaintenance = { id: generateId("assetmaint"), assetId: input.assetId, type: input.type, status: "due", scheduledDate: input.scheduledDate, notes: input.notes, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, assetMaintenance: [maintenance, ...current.assetMaintenance], assets: current.assets.map((a) => (a.id === input.assetId ? { ...a, status: "maintenance", updatedAt: now } : a)) }));
  logResourceAudit({ domain: "asset", subjectId: input.assetId, action: "asset-maintenance-created", actorName: actor.name, actorRole: actor.role, summary: `${input.type} maintenance scheduled for "${asset.name}".` });
  return { ok: true, maintenance };
}

export function completeMaintenance(maintenanceId: string, actor: Actor, opts: { cost?: Money; nextServiceDate?: string; downtimeHours?: number }): Result {
  const db = getSnapshot();
  const maintenance = db.assetMaintenance.find((m) => m.id === maintenanceId);
  if (!maintenance) return { ok: false, error: "Maintenance record not found." };
  const now = new Date().toISOString();
  setState((current) => ({
    ...current,
    assetMaintenance: current.assetMaintenance.map((m) => (m.id === maintenanceId ? { ...m, status: "completed", completedDate: now.slice(0, 10), cost: opts.cost ?? m.cost, nextServiceDate: opts.nextServiceDate ?? m.nextServiceDate, downtimeHours: opts.downtimeHours, performedBy: actor.name, updatedAt: now } : m)),
    assets: current.assets.map((a) => (a.id === maintenance.assetId ? { ...a, status: "available", updatedAt: now } : a)),
  }));
  logResourceAudit({ domain: "asset", subjectId: maintenance.assetId, action: "asset-maintenance-completed", actorName: actor.name, actorRole: actor.role, summary: `Maintenance completed.` });
  return { ok: true };
}

/** Runs depreciation to `asOf`, recording a schedule entry and updating the
 * asset's accumulated depreciation. Decimal-safe (integer minor units). */
export function runDepreciation(assetId: string, actor: Actor, asOf = new Date().toISOString().slice(0, 10)): Result & { bookValue?: Money } {
  const db = getSnapshot();
  const asset = db.assets.find((a) => a.id === assetId);
  if (!asset) return { ok: false, error: "Asset not found." };
  const periods = periodsElapsed(asset.depreciationStartDate, asOf);
  const accumulated = accumulatedDepreciation(asset.cost, asset.salvageValue, asset.usefulLifeYears, asset.depreciationMethod, periods);
  const book = currentBookValue(asset, asOf);
  const now = new Date().toISOString();
  const entry = { id: generateId("assetdep"), assetId, periodLabel: `As of ${asOf}`, method: asset.depreciationMethod, openingBookValue: asset.cost, depreciationAmount: accumulated, accumulatedDepreciation: accumulated, closingBookValue: book, runAt: now };
  setState((current) => ({ ...current, assetDepreciation: [entry, ...current.assetDepreciation], assets: current.assets.map((a) => (a.id === assetId ? { ...a, accumulatedDepreciation: accumulated, updatedAt: now } : a)) }));
  logResourceAudit({ domain: "asset", subjectId: assetId, action: "asset-depreciation-run", actorName: actor.name, actorRole: actor.role, summary: `Depreciation run for "${asset.name}".` });
  return { ok: true, bookValue: book };
}

/** Controlled disposal — records the request/approval, links a journal entry
 * placeholder and closes the asset. History is preserved (never hard-deleted). */
export function disposeAsset(input: { assetId: string; reason: DisposalReason; disposalValue?: Money; recipient?: string; notes?: string; approvedBy?: string }, actor: Actor): Result & { disposal?: AssetDisposal } {
  const db = getSnapshot();
  const asset = db.assets.find((a) => a.id === input.assetId);
  if (!asset) return { ok: false, error: "Asset not found." };
  if (asset.status === "disposed") return { ok: false, error: "Asset is already disposed." };
  const active = db.assetAssignments.find((a) => a.assetId === input.assetId && a.status === "active");
  if (active) return { ok: false, error: "Return the asset from its active assignment before disposal." };

  const now = new Date().toISOString();
  const disposal: AssetDisposal = { id: generateId("assetdisp"), assetId: input.assetId, reason: input.reason, status: input.approvedBy ? "completed" : "requested", requestedBy: actor.name, approvedBy: input.approvedBy, disposalValue: input.disposalValue, recipient: input.recipient, notes: input.notes, requestedAt: now, completedAt: input.approvedBy ? now : undefined, createdAt: now, updatedAt: now };
  setState((current) => ({ ...current, assetDisposals: [disposal, ...current.assetDisposals], assets: current.assets.map((a) => (a.id === input.assetId ? { ...a, status: input.approvedBy ? "disposed" : "retired", updatedAt: now } : a)) }));
  logResourceAudit({ domain: "asset", subjectId: input.assetId, action: "asset-disposed", actorName: actor.name, actorRole: actor.role, summary: `Disposal ${input.approvedBy ? "completed" : "requested"} for "${asset.name}" (${input.reason}).`, reason: input.notes });
  return { ok: true, disposal };
}
