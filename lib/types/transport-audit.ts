import type { ID } from "./common";

export type TransportAuditAction =
  | "route-created"
  | "route-updated"
  | "route-archived"
  | "stop-changed"
  | "vehicle-created"
  | "vehicle-updated"
  | "vehicle-assigned"
  | "driver-assigned"
  | "attendant-assigned"
  | "student-assigned"
  | "student-removed"
  | "trip-started"
  | "trip-completed"
  | "trip-cancelled"
  | "pickup-marked"
  | "drop-marked"
  | "gps-lost"
  | "route-deviation"
  | "incident-reported"
  | "incident-updated"
  | "maintenance-created"
  | "maintenance-completed"
  | "fuel-entry-added"
  | "document-updated"
  | "notification-sent"
  | "manual-override-used";

export const transportAuditActionLabels: Record<TransportAuditAction, string> = {
  "route-created": "Route created",
  "route-updated": "Route updated",
  "route-archived": "Route archived",
  "stop-changed": "Stop changed",
  "vehicle-created": "Vehicle created",
  "vehicle-updated": "Vehicle updated",
  "vehicle-assigned": "Vehicle assigned",
  "driver-assigned": "Driver assigned",
  "attendant-assigned": "Attendant assigned",
  "student-assigned": "Student assigned",
  "student-removed": "Student removed",
  "trip-started": "Trip started",
  "trip-completed": "Trip completed",
  "trip-cancelled": "Trip cancelled",
  "pickup-marked": "Pickup marked",
  "drop-marked": "Drop marked",
  "gps-lost": "GPS lost",
  "route-deviation": "Route deviation",
  "incident-reported": "Incident reported",
  "incident-updated": "Incident updated",
  "maintenance-created": "Maintenance created",
  "maintenance-completed": "Maintenance completed",
  "fuel-entry-added": "Fuel entry added",
  "document-updated": "Document updated",
  "notification-sent": "Parent notification sent",
  "manual-override-used": "Manual override used",
};

/** Append-only transport audit trail — same single-log pattern as
 * logFinancialAudit()/logExamAudit(), applied to fleet/route/safety
 * mutations. `tripId` is transport-specific context finance/exam audits
 * don't need. */
export type TransportAuditEvent = {
  id: ID;
  subjectId?: ID;
  action: TransportAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  tenantId: string;
  branch: string;
  tripId?: ID;
  createdAt: string;
};
