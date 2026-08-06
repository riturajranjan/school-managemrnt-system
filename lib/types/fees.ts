import type { ID } from "./common";
import type { CurrencyCode, Money } from "@/lib/finance/money";

export type FeeComponentType =
  | "admission"
  | "tuition"
  | "annual"
  | "examination"
  | "transport"
  | "hostel"
  | "library"
  | "laboratory"
  | "activity"
  | "development"
  | "smart-class"
  | "registration"
  | "security-deposit"
  | "late-fee"
  | "custom";

export const feeComponentTypeLabels: Record<FeeComponentType, string> = {
  admission: "Admission fee",
  tuition: "Tuition fee",
  annual: "Annual fee",
  examination: "Examination fee",
  transport: "Transport fee",
  hostel: "Hostel fee",
  library: "Library fee",
  laboratory: "Laboratory fee",
  activity: "Activity fee",
  development: "Development fee",
  "smart-class": "Smart class fee",
  registration: "Registration fee",
  "security-deposit": "Security deposit",
  "late-fee": "Late fee",
  custom: "Custom fee component",
};

/** A school-managed registry entry behind the fee-component picker — the 15
 * built-in types are pre-seeded and read-only; schools add their own on top
 * (e.g. "Uniform fee") without touching the FeeComponentType union itself. */
export type FeeCategory = {
  id: ID;
  name: string;
  description?: string;
  componentType: FeeComponentType;
  builtIn: boolean;
  status: "active" | "inactive";
  createdAt: string;
};

export type FeeFrequency = "one-time" | "monthly" | "quarterly" | "half-yearly" | "annual" | "custom";

export const feeFrequencyLabels: Record<FeeFrequency, string> = {
  "one-time": "One time",
  monthly: "Monthly",
  quarterly: "Quarterly",
  "half-yearly": "Half-yearly",
  annual: "Annual",
  custom: "Custom schedule",
};

export type ProrationRule = "none" | "monthly-prorated" | "quarterly-prorated" | "full-term-only";

export const prorationRuleLabels: Record<ProrationRule, string> = {
  none: "No proration",
  "monthly-prorated": "Prorate by month",
  "quarterly-prorated": "Prorate by quarter",
  "full-term-only": "Full term only (no proration)",
};

/** One line within a fee structure — e.g. "Tuition fee" ₹28,000, taxable,
 * non-refundable, mandatory. A structure's total is the sum of its
 * components' amounts. */
export type FeeComponent = {
  id: ID;
  type: FeeComponentType;
  label: string;
  amount: Money;
  taxable: boolean;
  taxPercent?: number;
  refundable: boolean;
  optional: boolean;
};

/** One payable slice of a structure's total — e.g. "Installment 2, due 15
 * Sep". `componentIds` limits which components this installment covers;
 * empty means a proportional share of every component. */
export type FeeInstallment = {
  id: ID;
  label: string;
  dueDate: string;
  amount: Money;
  componentIds: ID[];
};

export type FeeRuleType = "proration" | "grace-period" | "discount-eligibility" | "custom";

/** A generic, structure-scoped rule for anything not already captured by a
 * first-class field (e.g. "hostel component excluded from sibling discount"). */
export type FeeRule = {
  id: ID;
  structureId: ID;
  type: FeeRuleType;
  description: string;
};

export type AdmissionTypeFilter = "new" | "existing" | "transfer" | "all";

export const admissionTypeFilterLabels: Record<AdmissionTypeFilter, string> = {
  new: "New admissions",
  existing: "Existing students",
  transfer: "Transfer students",
  all: "All students",
};

export type FeeStructureStatus = "draft" | "active" | "archived";

export type FeeStructure = {
  id: ID;
  name: string;
  session: string;
  branch: string;
  /** Empty = applies to every class. */
  applicableClassIds: ID[];
  /** Empty = applies to every section within the applicable classes. */
  applicableSectionIds: ID[];
  admissionType: AdmissionTypeFilter;
  studentCategory?: string;
  components: FeeComponent[];
  frequency: FeeFrequency;
  installments: FeeInstallment[];
  gracePeriodDays: number;
  lateFeeRuleId?: ID;
  discountCompatible: boolean;
  prorationRule: ProrationRule;
  currency: CurrencyCode;
  status: FeeStructureStatus;
  version: number;
  previousVersionId?: ID;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
};

export type StudentFeeAssignmentStatus = "active" | "superseded" | "withdrawn";

/** Links a student to a fee structure for a session — the act of "billing"
 * a student. Generates the underlying StudentFeeItem rows. */
export type StudentFeeAssignment = {
  id: ID;
  studentId: ID;
  session: string;
  structureId: ID;
  discountIds: ID[];
  scholarshipIds: ID[];
  /** Which of the structure's optional components this student opted into. */
  optionalComponentIds: ID[];
  status: StudentFeeAssignmentStatus;
  /** Set for mid-session admissions — installments due before this date are prorated out. */
  proratedFromDate?: string;
  assignedAt: string;
  assignedBy: string;
  notes?: string;
};

export type StudentFeeItemStatus = "pending" | "partial" | "paid" | "overdue" | "waived" | "cancelled";

/** The finest-grained billable unit — one fee component within one
 * installment for one student. Every collection, dues, and reporting screen
 * ultimately reads or writes these rows. */
export type StudentFeeItem = {
  id: ID;
  assignmentId: ID;
  studentId: ID;
  session: string;
  structureId: ID;
  componentId: ID;
  componentType: FeeComponentType;
  installmentId?: ID;
  label: string;
  billedAmount: Money;
  discountAmount: Money;
  scholarshipAmount: Money;
  fineAmount: Money;
  paidAmount: Money;
  dueDate: string;
  status: StudentFeeItemStatus;
  refundable: boolean;
};

export type ApprovalWorkflowStatus = "draft" | "submitted" | "under-review" | "approved" | "rejected" | "active" | "expired" | "revoked";

export const approvalWorkflowStatusLabels: Record<ApprovalWorkflowStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  "under-review": "Under review",
  approved: "Approved",
  rejected: "Rejected",
  active: "Active",
  expired: "Expired",
  revoked: "Revoked",
};

export type DiscountType = "percentage" | "fixed-amount" | "sibling" | "staff-child" | "early-payment" | "merit" | "promotional" | "custom";

export const discountTypeLabels: Record<DiscountType, string> = {
  percentage: "Percentage",
  "fixed-amount": "Fixed amount",
  sibling: "Sibling discount",
  "staff-child": "Staff-child discount",
  "early-payment": "Early-payment discount",
  merit: "Merit discount",
  promotional: "Promotional discount",
  custom: "Custom discount",
};

export type Discount = {
  id: ID;
  name: string;
  type: DiscountType;
  studentId: ID;
  percent?: number;
  amount?: Money;
  applicableComponentIds: ID[];
  session: string;
  effectiveFrom: string;
  effectiveTo?: string;
  maxAmount?: Money;
  status: ApprovalWorkflowStatus;
  approvedBy?: string;
  approvedAt?: string;
  createdBy: string;
  createdAt: string;
};

export type ConcessionReason = "temporary" | "financial-hardship" | "special-approval" | "medical" | "management-decision" | "custom";

export const concessionReasonLabels: Record<ConcessionReason, string> = {
  temporary: "Temporary concession",
  "financial-hardship": "Financial hardship",
  "special-approval": "Special approval",
  medical: "Medical reason",
  "management-decision": "Management decision",
  custom: "Custom reason",
};

export type Concession = {
  id: ID;
  studentId: ID;
  reason: ConcessionReason;
  description: string;
  amount: Money;
  applicableComponentIds: ID[];
  effectiveFrom: string;
  effectiveTo?: string;
  status: ApprovalWorkflowStatus;
  approvedBy?: string;
  approvedAt?: string;
  supportingDocumentName?: string;
  createdBy: string;
  createdAt: string;
};

export type ScholarshipType = "merit" | "need-based" | "sports" | "arts" | "government" | "external-sponsorship" | "school-funded" | "custom";

export const scholarshipTypeLabels: Record<ScholarshipType, string> = {
  merit: "Merit scholarship",
  "need-based": "Need-based scholarship",
  sports: "Sports scholarship",
  arts: "Arts scholarship",
  government: "Government scholarship",
  "external-sponsorship": "External sponsorship",
  "school-funded": "School-funded scholarship",
  custom: "Custom scholarship",
};

export type Scholarship = {
  id: ID;
  name: string;
  type: ScholarshipType;
  studentId: ID;
  session: string;
  percent?: number;
  amount?: Money;
  applicableComponentIds: ID[];
  budgetId?: ID;
  effectiveFrom: string;
  effectiveTo?: string;
  renewable: boolean;
  status: ApprovalWorkflowStatus;
  approvedBy?: string;
  approvedAt?: string;
  supportingDocumentName?: string;
  createdBy: string;
  createdAt: string;
};

export type LateFeeCalcType = "fixed" | "percentage" | "daily" | "weekly" | "monthly" | "slab";

export const lateFeeCalcTypeLabels: Record<LateFeeCalcType, string> = {
  fixed: "Fixed amount",
  percentage: "Percentage of due",
  daily: "Daily fine",
  weekly: "Weekly fine",
  monthly: "Monthly fine",
  slab: "Slab-based fine",
};

export type LateFeeSlab = { fromDay: number; toDay?: number; amount: Money };

export type LateFeeRule = {
  id: ID;
  name: string;
  calcType: LateFeeCalcType;
  amount?: Money;
  percent?: number;
  slabs?: LateFeeSlab[];
  gracePeriodDays: number;
  maxCapAmount?: Money;
  applicableComponentIds: ID[];
  applicableClassIds: ID[];
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type ReminderChannel = "in-app" | "email" | "sms" | "whatsapp" | "push";

export const reminderChannelLabels: Record<ReminderChannel, string> = {
  "in-app": "In-app",
  email: "Email",
  sms: "SMS",
  whatsapp: "WhatsApp",
  push: "Push notification",
};

export type ReminderTrigger = "before-due" | "on-due" | "overdue" | "failed-payment" | "link-expiry" | "cheque-failure" | "upcoming-installment";

export const reminderTriggerLabels: Record<ReminderTrigger, string> = {
  "before-due": "Before due date",
  "on-due": "On due date",
  overdue: "Overdue",
  "failed-payment": "Failed online payment",
  "link-expiry": "Payment link expiry",
  "cheque-failure": "Cheque failure",
  "upcoming-installment": "Upcoming installment",
};

export type ReminderAudience = "parent" | "student" | "both";

/** One record of a reminder actually going out — `ruleId` undefined means it
 * was a manual/ad-hoc send from the dues workspace rather than an automated
 * trigger. Distinct from ReminderRule, which only configures *when* sends
 * should happen. */
export type ReminderLog = {
  id: ID;
  studentId: ID;
  ruleId?: ID;
  channel: ReminderChannel;
  sentAt: string;
  sentBy: string;
};

export type ReminderRule = {
  id: ID;
  name: string;
  trigger: ReminderTrigger;
  offsetDays?: number;
  channels: ReminderChannel[];
  audience: ReminderAudience;
  templateEn: string;
  templateHi?: string;
  quietHoursStart?: string;
  quietHoursEnd?: string;
  maxReminders: number;
  retryIntervalHours?: number;
  escalateAfterCount?: number;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};
