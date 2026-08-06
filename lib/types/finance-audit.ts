import type { ID } from "./common";

export type FinancialAuditAction =
  | "fee-category-created"
  | "fee-category-updated"
  | "fee-structure-created"
  | "fee-structure-updated"
  | "fee-structure-archived"
  | "fee-assigned"
  | "payment-recorded"
  | "payment-edited"
  | "receipt-issued"
  | "receipt-cancelled"
  | "refund-requested"
  | "refund-approved"
  | "refund-completed"
  | "scholarship-applied"
  | "discount-applied"
  | "concession-applied"
  | "fine-waived"
  | "reconciliation-completed"
  | "reminder-rule-changed"
  | "late-fee-rule-changed"
  | "expense-created"
  | "expense-approved"
  | "expense-rejected"
  | "expense-paid"
  | "vendor-created"
  | "vendor-updated"
  | "purchase-order-created"
  | "purchase-order-approved"
  | "purchase-order-status-changed"
  | "journal-posted"
  | "journal-reversed"
  | "budget-created"
  | "budget-revised"
  | "cashier-shift-closed"
  | "payroll-calculated"
  | "payroll-approved"
  | "payroll-locked"
  | "payslip-generated"
  | "loan-approved"
  | "advance-approved"
  | "manual-override-used";

export const financialAuditActionLabels: Record<FinancialAuditAction, string> = {
  "fee-category-created": "Fee category created",
  "fee-category-updated": "Fee category updated",
  "fee-structure-created": "Fee structure created",
  "fee-structure-updated": "Fee structure updated",
  "fee-structure-archived": "Fee structure archived",
  "fee-assigned": "Fee assigned",
  "payment-recorded": "Payment recorded",
  "payment-edited": "Payment edited",
  "receipt-issued": "Receipt issued",
  "receipt-cancelled": "Receipt cancelled",
  "refund-requested": "Refund requested",
  "refund-approved": "Refund approved",
  "refund-completed": "Refund completed",
  "scholarship-applied": "Scholarship applied",
  "discount-applied": "Discount applied",
  "concession-applied": "Concession applied",
  "fine-waived": "Fine waived",
  "reconciliation-completed": "Reconciliation completed",
  "reminder-rule-changed": "Reminder rule changed",
  "late-fee-rule-changed": "Late fee rule changed",
  "expense-created": "Expense created",
  "expense-approved": "Expense approved",
  "expense-rejected": "Expense rejected",
  "expense-paid": "Expense paid",
  "vendor-created": "Vendor created",
  "vendor-updated": "Vendor updated",
  "purchase-order-created": "Purchase order created",
  "purchase-order-approved": "Purchase order approved",
  "purchase-order-status-changed": "Purchase order status changed",
  "journal-posted": "Journal posted",
  "journal-reversed": "Journal reversed",
  "budget-created": "Budget created",
  "budget-revised": "Budget revised",
  "cashier-shift-closed": "Cashier shift closed",
  "payroll-calculated": "Payroll calculated",
  "payroll-approved": "Payroll approved",
  "payroll-locked": "Payroll locked",
  "payslip-generated": "Payslip generated",
  "loan-approved": "Loan approved",
  "advance-approved": "Advance approved",
  "manual-override-used": "Manual override used",
};

/** Append-only financial audit trail — mirrors the exam-domain audit log
 * pattern (lib/services/exam-audit-service.ts) applied to money. `tenantId`/
 * `branch` are carried on every entry even though this demo only ever runs
 * a single tenant/branch, so the shape is ready for real multi-tenancy
 * without a later migration. */
export type FinancialAuditEvent = {
  id: ID;
  subjectId?: ID;
  action: FinancialAuditAction;
  actorName: string;
  actorRole: string;
  summary: string;
  previousValue?: string;
  newValue?: string;
  reason?: string;
  tenantId: string;
  branch: string;
  session?: string;
  createdAt: string;
};
