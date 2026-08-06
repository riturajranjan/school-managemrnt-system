import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

export type PaymentMethod = "cash" | "card" | "upi" | "bank-transfer" | "cheque" | "demand-draft" | "online-gateway" | "wallet" | "credit-adjustment" | "custom";

export const paymentMethodLabels: Record<PaymentMethod, string> = {
  cash: "Cash",
  card: "Card",
  upi: "UPI",
  "bank-transfer": "Bank transfer",
  cheque: "Cheque",
  "demand-draft": "Demand draft",
  "online-gateway": "Online gateway",
  wallet: "Wallet",
  "credit-adjustment": "Credit adjustment",
  custom: "Custom method",
};

export type PaymentGatewayProvider = "razorpay" | "stripe" | "cashfree" | "payu" | "phonepe" | "paytm" | "bank-hosted" | "custom";

export const paymentGatewayProviderLabels: Record<PaymentGatewayProvider, string> = {
  razorpay: "Razorpay",
  stripe: "Stripe",
  cashfree: "Cashfree",
  payu: "PayU",
  phonepe: "PhonePe",
  paytm: "Paytm",
  "bank-hosted": "Bank-hosted gateway",
  custom: "Custom provider",
};

/** Gateway-agnostic transaction lifecycle — every provider's own status
 * vocabulary is mapped into this set at the integration boundary so nothing
 * downstream (UI, reports, reconciliation) needs to know which gateway was used. */
export type PaymentGatewayStatus =
  | "created"
  | "pending"
  | "authorized"
  | "successful"
  | "failed"
  | "cancelled"
  | "refunded"
  | "partially-refunded"
  | "disputed"
  | "expired"
  | "reconciled";

export const paymentGatewayStatusLabels: Record<PaymentGatewayStatus, string> = {
  created: "Created",
  pending: "Pending",
  authorized: "Authorized",
  successful: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  "partially-refunded": "Partially refunded",
  disputed: "Disputed",
  expired: "Expired",
  reconciled: "Reconciled",
};

export type InvoiceStatus = "draft" | "issued" | "paid" | "partially-paid" | "overdue" | "cancelled";

/** A generated grouping of StudentFeeItem rows presented to a parent as one
 * bill (e.g. "Term 1 invoice") — the document; StudentFeeItem is the ledger. */
export type Invoice = {
  id: ID;
  studentId: ID;
  session: string;
  itemIds: ID[];
  totalAmount: Money;
  dueDate: string;
  status: InvoiceStatus;
  issuedAt?: string;
  createdAt: string;
};

export type PaymentStatus = "created" | "pending" | "successful" | "failed" | "cancelled" | "refunded" | "partially-refunded";

export const paymentStatusLabels: Record<PaymentStatus, string> = {
  created: "Created",
  pending: "Pending",
  successful: "Successful",
  failed: "Failed",
  cancelled: "Cancelled",
  refunded: "Refunded",
  "partially-refunded": "Partially refunded",
};

export type Payment = {
  id: ID;
  studentId: ID;
  session: string;
  amount: Money;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionReference?: string;
  gatewayProvider?: PaymentGatewayProvider;
  gatewayStatus?: PaymentGatewayStatus;
  gatewayPaymentId?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  paidAt: string;
  branch: string;
  cashierName: string;
  note?: string;
  receiptId?: string;
  /** Client-generated key that makes re-submitting the same collection
   * request (double-tap, network retry) a no-op instead of a double charge. */
  idempotencyKey: string;
  createdAt: string;
};

/** How one payment's amount was split across fee-ledger lines — a payment
 * for ₹15,000 might cover two different installments across two components. */
export type PaymentAllocation = {
  id: ID;
  paymentId: ID;
  feeItemId: ID;
  amount: Money;
};

export type PaymentLinkStatus = "active" | "paid" | "expired" | "cancelled";

/** `studentIds` can hold more than one student — a parent with multiple
 * children can settle every linked child's dues through one shared link
 * (spec: "multiple children in one payment"). Each StudentFeeItem already
 * carries its own studentId, so settlement splits automatically per student
 * without needing a separate grouping structure here. */
export type PaymentLink = {
  id: ID;
  studentIds: ID[];
  itemIds: ID[];
  amount: Money;
  status: PaymentLinkStatus;
  url: string;
  expiresAt: string;
  createdAt: string;
  createdBy: string;
  paidAt?: string;
  /** Marks intent to set up a recurring mandate — no autopay execution is
   * implemented, since that requires a real bank/NACH integration this demo
   * doesn't have. */
  recurring?: boolean;
};

export type ReceiptStatus = "draft" | "issued" | "cancelled" | "refunded" | "partially-refunded" | "replaced";

export const receiptStatusLabels: Record<ReceiptStatus, string> = {
  draft: "Draft",
  issued: "Issued",
  cancelled: "Cancelled",
  refunded: "Refunded",
  "partially-refunded": "Partially refunded",
  replaced: "Replaced",
};

export type ReceiptLineItem = { label: string; amount: Money };

export type Receipt = {
  id: ID;
  receiptNumber: string;
  paymentId: ID;
  studentId: ID;
  session: string;
  branch: string;
  items: ReceiptLineItem[];
  method: PaymentMethod;
  amount: Money;
  discount: Money;
  fine: Money;
  tax: Money;
  total: Money;
  issuedAt: string;
  cashierName: string;
  notes?: string;
  gatewayReference?: string;
  status: ReceiptStatus;
  supersededByReceiptId?: string;
};

export type RefundReason =
  | "duplicate-payment"
  | "excess-payment"
  | "student-withdrawal"
  | "service-not-used"
  | "transport-cancellation"
  | "hostel-cancellation"
  | "fee-correction"
  | "scholarship-adjustment"
  | "custom";

export const refundReasonLabels: Record<RefundReason, string> = {
  "duplicate-payment": "Duplicate payment",
  "excess-payment": "Excess payment",
  "student-withdrawal": "Student withdrawal",
  "service-not-used": "Service not used",
  "transport-cancellation": "Transport cancellation",
  "hostel-cancellation": "Hostel cancellation",
  "fee-correction": "Fee correction",
  "scholarship-adjustment": "Scholarship adjustment",
  custom: "Custom reason",
};

export type RefundStatus = "draft" | "submitted" | "approved" | "rejected" | "processing" | "completed" | "failed" | "cancelled";

export const refundStatusLabels: Record<RefundStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  approved: "Approved",
  rejected: "Rejected",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  cancelled: "Cancelled",
};

export type RefundMethod = "original-method" | "bank-transfer" | "cheque" | "credit-balance" | "cash";

export const refundMethodLabels: Record<RefundMethod, string> = {
  "original-method": "Original payment method",
  "bank-transfer": "Bank transfer",
  cheque: "Cheque",
  "credit-balance": "Student credit balance",
  cash: "Cash",
};

export type Refund = {
  id: ID;
  paymentId: ID;
  studentId: ID;
  amount: Money;
  reason: RefundReason;
  note?: string;
  method: RefundMethod;
  status: RefundStatus;
  requestedBy: string;
  requestedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  processedAt?: string;
  refundReceiptId?: string;
};

export type CreditBalanceSource = "refund" | "overpayment" | "manual-credit";

export type CreditBalance = {
  id: ID;
  studentId: ID;
  amount: Money;
  consumedAmount: Money;
  source: CreditBalanceSource;
  note?: string;
  createdAt: string;
};

export type ReconciliationSource = "gateway-settlement" | "bank-statement" | "cash-register" | "cheque-register" | "upi-settlement" | "imported-statement" | "manual";

export const reconciliationSourceLabels: Record<ReconciliationSource, string> = {
  "gateway-settlement": "Payment gateway settlement",
  "bank-statement": "Bank statement",
  "cash-register": "Cash register",
  "cheque-register": "Cheque register",
  "upi-settlement": "UPI settlement",
  "imported-statement": "Imported statement",
  manual: "Manual transaction",
};

export type BankTransaction = {
  id: ID;
  source: ReconciliationSource;
  amount: Money;
  date: string;
  reference: string;
  description?: string;
  importedAt: string;
};

export type ReconciliationStatus = "matched" | "partially-matched" | "unmatched" | "duplicate" | "under-review" | "ignored" | "reconciled";

export const reconciliationStatusLabels: Record<ReconciliationStatus, string> = {
  matched: "Matched",
  "partially-matched": "Partially matched",
  unmatched: "Unmatched",
  duplicate: "Duplicate",
  "under-review": "Under review",
  ignored: "Ignored",
  reconciled: "Reconciled",
};

/** The match between one bank/gateway transaction and one internal payment
 * (or the lack thereof). AI-assisted matching only ever proposes a
 * `matchConfidence` here — a human still has to confirm via `match()`. */
export type ReconciliationRecord = {
  id: ID;
  bankTransactionId?: ID;
  paymentId?: ID;
  status: ReconciliationStatus;
  matchConfidence?: number;
  difference?: Money;
  ignoredReason?: string;
  reconciledBy?: string;
  reconciledAt?: string;
  createdAt: string;
};
