export type ID = string;

// Mirrors components/dashboard/data/types.ts's StatusTone — kept in sync so
// Phase 2 status colors map through the same tone → class system as Phase 1.
export type StatusTone = "success" | "warning" | "error" | "info" | "neutral";

export type SortDirection = "asc" | "desc";

export type SortState = { columnId: string; direction: SortDirection } | null;

export type PaginationState = { page: number; pageSize: number };

export type PaginatedResult<T> = {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type DocumentStatus =
  | "missing"
  | "uploaded"
  | "under-review"
  | "approved"
  | "rejected"
  | "expired"
  | "re-upload-requested";

export const documentStatusLabels: Record<DocumentStatus, string> = {
  missing: "Missing",
  uploaded: "Uploaded",
  "under-review": "Under review",
  approved: "Approved",
  rejected: "Rejected",
  expired: "Expired",
  "re-upload-requested": "Re-upload requested",
};

export type DocumentVersion = {
  id: ID;
  fileName: string;
  uploadedAt: string;
  uploadedBy: string;
  sizeKb: number;
};

export type DocumentType =
  | "birth-certificate"
  | "previous-report-card"
  | "transfer-certificate"
  | "address-proof"
  | "identity-proof"
  | "student-photo"
  | "parent-identity-proof"
  | "medical-record"
  | "custom";

export const documentTypeLabels: Record<DocumentType, string> = {
  "birth-certificate": "Birth certificate",
  "previous-report-card": "Previous report card",
  "transfer-certificate": "Transfer certificate",
  "address-proof": "Address proof",
  "identity-proof": "Identity proof",
  "student-photo": "Student photo",
  "parent-identity-proof": "Parent identity proof",
  "medical-record": "Medical record",
  custom: "Custom document",
};

export type DocumentRecord = {
  id: ID;
  ownerId: ID;
  type: DocumentType;
  customLabel?: string;
  status: DocumentStatus;
  fileName?: string;
  sizeKb?: number;
  uploadedAt?: string;
  uploadedBy?: string;
  verifiedBy?: string;
  verifiedAt?: string;
  expiryDate?: string;
  rejectionReason?: string;
  notes?: string;
  versions: DocumentVersion[];
};

export type CommunicationPreference = "sms" | "email" | "whatsapp" | "call";

export type ContactInfo = {
  email?: string;
  phone: string;
  alternatePhone?: string;
};

export type Address = {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
};

export type TimelineCategory =
  | "admission"
  | "academic"
  | "attendance"
  | "fees"
  | "behaviour"
  | "documents"
  | "communication"
  | "transport"
  | "health"
  | "certificate"
  | "system";

export type TimelineEvent = {
  id: ID;
  subjectId: ID;
  category: TimelineCategory;
  title: string;
  detail?: string;
  actorName: string;
  actorRole?: string;
  createdAt: string;
  manual?: boolean;
};
