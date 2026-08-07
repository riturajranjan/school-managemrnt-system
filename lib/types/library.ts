import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

// ---------------------------------------------------------------------------
// Libraries and locations
// ---------------------------------------------------------------------------

/** A physical library. A tenant may run one or many (main library, junior wing,
 * science reference room). Every catalogue, copy, shelf and loan is scoped to a
 * library so multi-library schools stay isolated. */
export type Library = {
  id: ID;
  name: string;
  code: string;
  branch: string;
  location: string;
  isPrimary: boolean;
  openingHours?: string;
  createdAt: string;
  updatedAt: string;
};

/** Location hierarchy node: Library → Zone → Floor → Section → Rack → Shelf.
 * A Shelf row is the leaf that copies actually sit on; higher levels are
 * addressed through the shelf's denormalised path fields for fast display. */
export type ShelfLevel = "zone" | "floor" | "section" | "rack" | "shelf";

export const shelfLevelLabels: Record<ShelfLevel, string> = {
  zone: "Zone",
  floor: "Floor",
  section: "Section",
  rack: "Rack",
  shelf: "Shelf",
};

export type ShelfLocation = {
  id: ID;
  libraryId: ID;
  parentId?: ID;
  level: ShelfLevel;
  name: string;
  code: string;
  createdAt: string;
};

export type ShelfStocktakeStatus = "verified" | "due" | "overdue" | "in-progress" | "never";

export const shelfStocktakeStatusLabels: Record<ShelfStocktakeStatus, string> = {
  verified: "Verified",
  due: "Due",
  overdue: "Overdue",
  "in-progress": "In progress",
  never: "Never checked",
};

/** A shelf is where copies physically live. `capacity`/`occupied` drive the
 * isometric occupancy visualization; `path` is the human-readable
 * Zone › Floor › Section › Rack breadcrumb. */
export type Shelf = {
  id: ID;
  libraryId: ID;
  locationId?: ID;
  code: string;
  label: string;
  path: string;
  capacity: number;
  lastStockCheck?: string;
  stocktakeStatus: ShelfStocktakeStatus;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Authors, publishers, categories
// ---------------------------------------------------------------------------

export type Author = {
  id: ID;
  name: string;
  bio?: string;
  nationality?: string;
  createdAt: string;
};

export type Publisher = {
  id: ID;
  name: string;
  city?: string;
  contactEmail?: string;
  createdAt: string;
};

/** Classification category. `classification` carries a Dewey range or custom
 * code so the catalogue can group/browse by scheme without a separate table. */
export type BookCategory = {
  id: ID;
  name: string;
  parentId?: ID;
  classification?: string;
  colorTone?: "info" | "success" | "warning" | "neutral";
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Books and resources (the catalogue)
// ---------------------------------------------------------------------------

export type ResourceType =
  | "book"
  | "textbook"
  | "reference"
  | "magazine"
  | "journal"
  | "newspaper"
  | "ebook"
  | "audiobook"
  | "research-paper"
  | "question-bank"
  | "publication"
  | "document"
  | "video"
  | "external";

export const resourceTypeLabels: Record<ResourceType, string> = {
  book: "Book",
  textbook: "Textbook",
  reference: "Reference book",
  magazine: "Magazine",
  journal: "Journal",
  newspaper: "Newspaper",
  ebook: "E-book",
  audiobook: "Audiobook",
  "research-paper": "Research paper",
  "question-bank": "Question bank",
  publication: "School publication",
  document: "Digital document",
  video: "Video",
  external: "External resource",
};

/** Resource types that only ever exist digitally — no physical copies, no
 * loans, availability is governed by the DigitalResource access model. */
export const DIGITAL_ONLY_TYPES: ResourceType[] = ["ebook", "audiobook", "document", "video", "external"];

export type BookStatus =
  | "available"
  | "limited"
  | "fully-issued"
  | "reserved"
  | "reference-only"
  | "lost"
  | "damaged"
  | "archived"
  | "digital-only";

export const bookStatusLabels: Record<BookStatus, string> = {
  available: "Available",
  limited: "Limited availability",
  "fully-issued": "Fully issued",
  reserved: "Reserved",
  "reference-only": "Reference only",
  lost: "Lost",
  damaged: "Damaged",
  archived: "Archived",
  "digital-only": "Digital only",
};

export type Book = {
  id: ID;
  libraryId: ID;
  title: string;
  subtitle?: string;
  isbn?: string;
  accessionNumber: string;
  authorId?: ID;
  coAuthorIds: ID[];
  publisherId?: ID;
  edition?: string;
  publicationYear?: number;
  language: string;
  categoryId?: ID;
  subject?: string;
  classRange?: string;
  description?: string;
  coverColor?: string;
  keywords: string[];
  classification?: string;
  shelfId?: ID;
  rack?: string;
  referenceOnly: boolean;
  replacementCost: Money;
  status: BookStatus;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Physical copies
// ---------------------------------------------------------------------------

export type CopyCondition = "new" | "good" | "fair" | "worn" | "damaged" | "lost" | "under-repair";

export const copyConditionLabels: Record<CopyCondition, string> = {
  new: "New",
  good: "Good",
  fair: "Fair",
  worn: "Worn",
  damaged: "Damaged",
  lost: "Lost",
  "under-repair": "Under repair",
};

export type CopyLoanStatus = "on-shelf" | "issued" | "reserved" | "in-transit" | "withdrawn" | "lost";

export const copyLoanStatusLabels: Record<CopyLoanStatus, string> = {
  "on-shelf": "On shelf",
  issued: "Issued",
  reserved: "Reserved",
  "in-transit": "In transit",
  withdrawn: "Withdrawn",
  lost: "Lost",
};

export type BookCopy = {
  id: ID;
  bookId: ID;
  libraryId: ID;
  accessionNumber: string;
  barcode: string;
  qrToken: string;
  acquisitionDate: string;
  purchasePrice: Money;
  vendorId?: ID;
  shelfId?: ID;
  condition: CopyCondition;
  loanStatus: CopyLoanStatus;
  currentHolderId?: ID;
  lastStockCheck?: string;
  replacementCost: Money;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Members
// ---------------------------------------------------------------------------

export type MemberType = "student" | "teacher" | "staff" | "external";

export const memberTypeLabels: Record<MemberType, string> = {
  student: "Student",
  teacher: "Teacher",
  staff: "Staff",
  external: "External member",
};

export type MemberStatus = "active" | "suspended" | "expired" | "inactive";

export const memberStatusLabels: Record<MemberStatus, string> = {
  active: "Active",
  suspended: "Suspended",
  expired: "Expired",
  inactive: "Inactive",
};

export type LibraryMember = {
  id: ID;
  libraryId: ID;
  membershipId: string;
  type: MemberType;
  /** Links back to the person record (student/teacher id) when internal. */
  personId?: ID;
  name: string;
  classOrDept?: string;
  status: MemberStatus;
  joinedAt: string;
  expiresAt?: string;
  cardBarcode: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Loan rules
// ---------------------------------------------------------------------------

/** Configurable lending policy. Rules are matched most-specific-first against a
 * (memberType, resourceType, category) tuple; the fallback rule has all
 * selectors undefined. Fine amounts are Money so charges stay decimal-safe. */
export type LibraryRule = {
  id: ID;
  libraryId: ID;
  name: string;
  memberType?: MemberType;
  resourceType?: ResourceType;
  categoryId?: ID;
  maxBooks: number;
  loanDurationDays: number;
  renewalCount: number;
  renewalDurationDays: number;
  gracePeriodDays: number;
  finePerDay: Money;
  maxFine: Money;
  reservationAllowance: number;
  allowReferenceLoan: boolean;
  allowDigitalDownload: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Loans (circulation)
// ---------------------------------------------------------------------------

export type LoanStatus = "active" | "returned" | "overdue" | "lost" | "renewed" | "claimed-returned";

export const loanStatusLabels: Record<LoanStatus, string> = {
  active: "Issued",
  returned: "Returned",
  overdue: "Overdue",
  lost: "Lost",
  renewed: "Renewed",
  "claimed-returned": "Claimed returned",
};

export type LibraryLoan = {
  id: ID;
  libraryId: ID;
  copyId: ID;
  bookId: ID;
  memberId: ID;
  issuedAt: string;
  dueDate: string;
  returnedAt?: string;
  renewalCount: number;
  status: LoanStatus;
  issuedBy: string;
  returnedBy?: string;
  returnCondition?: CopyCondition;
  fineId?: ID;
  fulfilledReservationId?: ID;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Reservations
// ---------------------------------------------------------------------------

export type ReservationStatus = "waiting" | "ready" | "collected" | "expired" | "cancelled" | "fulfilled";

export const reservationStatusLabels: Record<ReservationStatus, string> = {
  waiting: "Waiting",
  ready: "Ready for pickup",
  collected: "Collected",
  expired: "Expired",
  cancelled: "Cancelled",
  fulfilled: "Fulfilled",
};

export type LibraryReservation = {
  id: ID;
  libraryId: ID;
  bookId: ID;
  /** Set only when a member reserved one specific copy (rare — most reserve the title). */
  copyId?: ID;
  memberId: ID;
  queuePosition: number;
  priority: number;
  status: ReservationStatus;
  pickupLibraryId: ID;
  reservedAt: string;
  readyAt?: string;
  expiresAt?: string;
  collectedAt?: string;
  cancelledAt?: string;
  notified: boolean;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Fines and charges
// ---------------------------------------------------------------------------

export type FineType = "overdue" | "lost" | "damage" | "processing" | "replacement" | "manual";

export const fineTypeLabels: Record<FineType, string> = {
  overdue: "Overdue fine",
  lost: "Lost-book charge",
  damage: "Damage charge",
  processing: "Processing fee",
  replacement: "Replacement fee",
  manual: "Manual fine",
};

export type FineStatus = "generated" | "pending" | "paid" | "partially-paid" | "waived" | "cancelled" | "refunded";

export const fineStatusLabels: Record<FineStatus, string> = {
  generated: "Generated",
  pending: "Pending",
  paid: "Paid",
  "partially-paid": "Partially paid",
  waived: "Waived",
  cancelled: "Cancelled",
  refunded: "Refunded",
};

export type LibraryFine = {
  id: ID;
  libraryId: ID;
  memberId: ID;
  loanId?: ID;
  copyId?: ID;
  type: FineType;
  amount: Money;
  paidAmount: Money;
  waivedAmount: Money;
  status: FineStatus;
  reason?: string;
  /** When added to the student's fee account, links to the finance charge id. */
  feeItemId?: ID;
  waivedBy?: string;
  waiverReason?: string;
  /** Deterministic idempotency key so an overdue fine is never generated twice
   * for the same (loanId, dayCount). */
  idempotencyKey: string;
  createdAt: string;
  updatedAt: string;
};

// ---------------------------------------------------------------------------
// Digital library
// ---------------------------------------------------------------------------

export type DigitalResourceType = "pdf" | "ebook" | "audio" | "video" | "link" | "question-paper" | "notes" | "research-paper" | "magazine" | "journal" | "publication";

export const digitalResourceTypeLabels: Record<DigitalResourceType, string> = {
  pdf: "PDF",
  ebook: "E-book",
  audio: "Audio",
  video: "Video",
  link: "Link",
  "question-paper": "Question paper",
  notes: "Notes",
  "research-paper": "Research paper",
  magazine: "Magazine",
  journal: "Journal",
  publication: "School publication",
};

export type AccessLevel = "public" | "students" | "teachers" | "staff" | "class" | "subject" | "role";

export const accessLevelLabels: Record<AccessLevel, string> = {
  public: "Public school resource",
  students: "Students",
  teachers: "Teachers",
  staff: "Staff",
  class: "Specific class",
  subject: "Specific subject",
  role: "Specific role",
};

export type DigitalResource = {
  id: ID;
  libraryId: ID;
  title: string;
  type: DigitalResourceType;
  bookId?: ID;
  fileUrl?: string;
  externalUrl?: string;
  authorId?: ID;
  subject?: string;
  classRange?: string;
  categoryId?: ID;
  description?: string;
  thumbnailColor?: string;
  accessLevel: AccessLevel;
  accessTarget?: string;
  allowDownload: boolean;
  expiresAt?: string;
  license?: string;
  version: number;
  language: string;
  viewCount: number;
  brokenLinkReported: boolean;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
};

/** One access event on a digital resource — powers usage analytics and the
 * per-member reading history without exposing file contents. */
export type DigitalResourceAccess = {
  id: ID;
  resourceId: ID;
  memberId: ID;
  action: "view" | "read" | "stream" | "download" | "bookmark";
  at: string;
};

// ---------------------------------------------------------------------------
// Stocktake
// ---------------------------------------------------------------------------

export type StocktakeScope = "full" | "shelf" | "category" | "random";

export const stocktakeScopeLabels: Record<StocktakeScope, string> = {
  full: "Full library",
  shelf: "Shelf",
  category: "Category",
  random: "Random audit",
};

export type StocktakeStatus = "draft" | "in-progress" | "review" | "completed" | "cancelled";

export const stocktakeStatusLabels: Record<StocktakeStatus, string> = {
  draft: "Draft",
  "in-progress": "In progress",
  review: "Review",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type LibraryStocktake = {
  id: ID;
  libraryId: ID;
  reference: string;
  scope: StocktakeScope;
  scopeTargetId?: ID;
  status: StocktakeStatus;
  startedBy: string;
  startedAt: string;
  completedAt?: string;
  expectedCount: number;
  scannedCount: number;
  missingCount: number;
  unexpectedCount: number;
  misplacedCount: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
};

export type StocktakeItemResult = "expected" | "scanned" | "missing" | "unexpected" | "misplaced";

export const stocktakeItemResultLabels: Record<StocktakeItemResult, string> = {
  expected: "Expected",
  scanned: "Found",
  missing: "Missing",
  unexpected: "Unexpected",
  misplaced: "Misplaced",
};

export type LibraryStocktakeItem = {
  id: ID;
  stocktakeId: ID;
  copyId: ID;
  expectedShelfId?: ID;
  foundShelfId?: ID;
  result: StocktakeItemResult;
  resolved: boolean;
  scannedAt?: string;
};

// ---------------------------------------------------------------------------
// UI helper models
// ---------------------------------------------------------------------------

/** Denormalised availability rollup for a title, computed from its copies. */
export type BookAvailability = {
  total: number;
  available: number;
  issued: number;
  reserved: number;
  lost: number;
  damaged: number;
};
