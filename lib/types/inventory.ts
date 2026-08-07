import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type InventoryCategory = {
  id: ID;
  name: string;
  parentId?: ID;
  /** Consumables are used up (stationery, cleaning); returnable/durable items
   * are expected back (lab kits, sports gear). Drives the issue/return flow. */
  consumable: boolean;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

export type InventoryItemStatus = "in-stock" | "low-stock" | "out-of-stock" | "expired" | "damaged" | "discontinued";

export const inventoryItemStatusLabels: Record<InventoryItemStatus, string> = {
  "in-stock": "In stock",
  "low-stock": "Low stock",
  "out-of-stock": "Out of stock",
  expired: "Expired",
  damaged: "Damaged",
  discontinued: "Discontinued",
};

export type InventoryItem = {
  id: ID;
  branch: string;
  name: string;
  sku: string;
  categoryId: ID;
  unit: string;
  brand?: string;
  description?: string;
  /** Derived from the movement ledger — never mutated directly. */
  quantity: number;
  minimumLevel: number;
  reorderLevel: number;
  maximumLevel: number;
  unitCost: Money;
  vendorId?: ID;
  taxPercent: number;
  storageLocation?: string;
  batch?: string;
  expiryDate?: string;
  status: InventoryItemStatus;
  barcode: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Movement ledger — the single source of truth for quantity changes
// ---------------------------------------------------------------------------

export type MovementType = "receipt" | "issue" | "return" | "transfer-out" | "transfer-in" | "adjustment" | "write-off";

export const movementTypeLabels: Record<MovementType, string> = {
  receipt: "Receipt",
  issue: "Issue",
  return: "Return",
  "transfer-out": "Transfer out",
  "transfer-in": "Transfer in",
  adjustment: "Adjustment",
  "write-off": "Write off",
};

/** Append-only quantity change. `quantityDelta` is signed (+in / −out). Current
 * item quantity is always the sum of its movements, so quantities can never go
 * negative and every change is auditable. */
export type InventoryMovement = {
  id: ID;
  itemId: ID;
  type: MovementType;
  quantityDelta: number;
  balanceAfter: number;
  unitCost: Money;
  reference?: string;
  linkedId?: ID;
  actorName: string;
  reason?: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Issue / return
// ---------------------------------------------------------------------------

export type IssueRecipientType = "student" | "teacher" | "staff" | "department" | "classroom" | "laboratory" | "event" | "transport" | "hostel" | "library";

export const issueRecipientTypeLabels: Record<IssueRecipientType, string> = {
  student: "Student",
  teacher: "Teacher",
  staff: "Staff",
  department: "Department",
  classroom: "Classroom",
  laboratory: "Laboratory",
  event: "Event",
  transport: "Transport",
  hostel: "Hostel",
  library: "Library",
};

export type IssueStatus = "issued" | "partially-returned" | "returned" | "consumed" | "overdue";

export const issueStatusLabels: Record<IssueStatus, string> = {
  issued: "Issued",
  "partially-returned": "Partially returned",
  returned: "Returned",
  consumed: "Consumed",
  overdue: "Overdue",
};

export type InventoryIssue = {
  id: ID;
  itemId: ID;
  quantity: number;
  returnedQuantity: number;
  recipientType: IssueRecipientType;
  recipientName: string;
  department?: string;
  purpose?: string;
  issueDate: string;
  expectedReturn?: string;
  returnable: boolean;
  approvedBy?: string;
  status: IssueStatus;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryReturn = {
  id: ID;
  issueId: ID;
  itemId: ID;
  returnedQuantity: number;
  condition: "good" | "damaged" | "lost";
  lostQuantity: number;
  damagedQuantity: number;
  chargeAmount?: Money;
  receivedBy: string;
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Transfers
// ---------------------------------------------------------------------------

export type TransferStatus = "requested" | "in-transit" | "completed" | "cancelled";

export const transferStatusLabels: Record<TransferStatus, string> = {
  requested: "Requested",
  "in-transit": "In transit",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type InventoryTransfer = {
  id: ID;
  itemId: ID;
  quantity: number;
  fromLocation: string;
  toLocation: string;
  status: TransferStatus;
  requestedBy: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Purchase requests (procurement — reuses Phase 5 vendors/POs)
// ---------------------------------------------------------------------------

export type PurchaseRequestStatus = "draft" | "pending-approval" | "approved" | "rejected" | "ordered" | "received";

export const purchaseRequestStatusLabels: Record<PurchaseRequestStatus, string> = {
  draft: "Draft",
  "pending-approval": "Pending approval",
  approved: "Approved",
  rejected: "Rejected",
  ordered: "Ordered",
  received: "Received",
};

export type PurchaseRequestLine = {
  itemId: ID;
  itemName: string;
  quantity: number;
  estimatedUnitCost: Money;
};

export type InventoryPurchaseRequest = {
  id: ID;
  branch: string;
  reference: string;
  lines: PurchaseRequestLine[];
  vendorId?: ID;
  status: PurchaseRequestStatus;
  requestedBy: string;
  approvedBy?: string;
  /** Links to the Phase 5 PurchaseOrder once converted. */
  purchaseOrderId?: ID;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Inventory stocktake
// ---------------------------------------------------------------------------

export type InventoryStocktakeStatus = "draft" | "in-progress" | "review" | "completed" | "cancelled";

export type InventoryStocktake = {
  id: ID;
  branch: string;
  reference: string;
  categoryId?: ID;
  status: InventoryStocktakeStatus;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export type InventoryStocktakeLine = {
  id: ID;
  stocktakeId: ID;
  itemId: ID;
  expectedQuantity: number;
  countedQuantity?: number;
  variance: number;
  resolved: boolean;
};
