import type { ID } from "./common";

/** Every mutating action across Library, Inventory and Asset operations logs
 * one of these. Mirrors the append-only single-log pattern of
 * TransportAuditEvent / FinancialAuditEvent, extended to cover resource ops. */
export type ResourceAuditAction =
  // Library — catalogue & copies
  | "book-created"
  | "book-updated"
  | "book-archived"
  | "copy-added"
  | "copy-updated"
  | "copy-transferred"
  | "copy-marked-lost"
  | "copy-marked-damaged"
  | "copy-repaired"
  | "copy-withdrawn"
  // Library — circulation
  | "member-created"
  | "member-updated"
  | "member-suspended"
  | "member-reinstated"
  | "book-issued"
  | "book-returned"
  | "loan-renewed"
  | "reservation-created"
  | "reservation-ready"
  | "reservation-collected"
  | "reservation-cancelled"
  | "fine-generated"
  | "fine-collected"
  | "fine-waived"
  | "fine-refunded"
  | "digital-uploaded"
  | "digital-updated"
  | "stocktake-created"
  | "stocktake-completed"
  // Inventory
  | "inventory-item-created"
  | "inventory-item-updated"
  | "inventory-received"
  | "inventory-issued"
  | "inventory-returned"
  | "inventory-transferred"
  | "inventory-adjusted"
  | "inventory-written-off"
  | "inventory-stocktake-completed"
  // Assets
  | "asset-created"
  | "asset-updated"
  | "asset-assigned"
  | "asset-returned"
  | "asset-maintenance-created"
  | "asset-maintenance-completed"
  | "asset-depreciation-run"
  | "asset-disposed"
  // Cross-cutting
  | "barcode-generated"
  | "manual-override-used";

export const resourceAuditActionLabels: Record<ResourceAuditAction, string> = {
  "book-created": "Book created",
  "book-updated": "Book updated",
  "book-archived": "Book archived",
  "copy-added": "Copy added",
  "copy-updated": "Copy updated",
  "copy-transferred": "Copy transferred",
  "copy-marked-lost": "Copy marked lost",
  "copy-marked-damaged": "Copy marked damaged",
  "copy-repaired": "Copy repaired",
  "copy-withdrawn": "Copy withdrawn",
  "member-created": "Member created",
  "member-updated": "Member updated",
  "member-suspended": "Member suspended",
  "member-reinstated": "Member reinstated",
  "book-issued": "Book issued",
  "book-returned": "Book returned",
  "loan-renewed": "Loan renewed",
  "reservation-created": "Reservation created",
  "reservation-ready": "Reservation ready",
  "reservation-collected": "Reservation collected",
  "reservation-cancelled": "Reservation cancelled",
  "fine-generated": "Fine generated",
  "fine-collected": "Fine collected",
  "fine-waived": "Fine waived",
  "fine-refunded": "Fine refunded",
  "digital-uploaded": "Digital resource uploaded",
  "digital-updated": "Digital resource updated",
  "stocktake-created": "Stocktake created",
  "stocktake-completed": "Stocktake completed",
  "inventory-item-created": "Inventory item created",
  "inventory-item-updated": "Inventory item updated",
  "inventory-received": "Inventory received",
  "inventory-issued": "Inventory issued",
  "inventory-returned": "Inventory returned",
  "inventory-transferred": "Inventory transferred",
  "inventory-adjusted": "Inventory adjusted",
  "inventory-written-off": "Inventory written off",
  "inventory-stocktake-completed": "Inventory stocktake completed",
  "asset-created": "Asset created",
  "asset-updated": "Asset updated",
  "asset-assigned": "Asset assigned",
  "asset-returned": "Asset returned",
  "asset-maintenance-created": "Maintenance scheduled",
  "asset-maintenance-completed": "Maintenance completed",
  "asset-depreciation-run": "Depreciation run",
  "asset-disposed": "Asset disposed",
  "barcode-generated": "Barcode generated",
  "manual-override-used": "Manual override used",
};

export type ResourceAuditDomain = "library" | "inventory" | "asset";

export type ResourceAuditEvent = {
  id: ID;
  domain: ResourceAuditDomain;
  subjectId?: ID;
  action: ResourceAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  tenantId: string;
  branch: string;
  createdAt: string;
};
