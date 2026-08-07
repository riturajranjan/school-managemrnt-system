import { getSnapshot, setState } from "@/lib/data/store";
import type { TransportShift } from "@/lib/types/transport";
import { logTransportAudit } from "./transport-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

export function updateShiftPolicy(shift: TransportShift, patch: { defaultPickupTime: string; defaultDropTime: string }, actor: Actor): Result {
  const db = getSnapshot();
  if (!db.transportShiftPolicies.some((p) => p.shift === shift)) return { ok: false, error: "Shift policy not found." };

  setState((current) => ({ ...current, transportShiftPolicies: current.transportShiftPolicies.map((p) => (p.shift === shift ? { ...p, ...patch } : p)) }));
  logTransportAudit({ action: "document-updated", actorName: actor.name, actorRole: actor.role, summary: `${shift} shift default times set to ${patch.defaultPickupTime} pickup / ${patch.defaultDropTime} drop.` });
  return { ok: true };
}
