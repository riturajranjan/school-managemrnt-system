import type { ID } from "./common";
import type { CurrencyCode, Money } from "@/lib/finance/money";
import type { PaymentMethod } from "./payments";

export type IncomeCategory = "fees" | "donations" | "grants" | "sponsorship" | "rental-income" | "event-income" | "sale-of-materials" | "interest" | "other-income";

export const incomeCategoryLabels: Record<IncomeCategory, string> = {
  fees: "Fees",
  donations: "Donations",
  grants: "Grants",
  sponsorship: "Sponsorship",
  "rental-income": "Rental income",
  "event-income": "Event income",
  "sale-of-materials": "Sale of materials",
  interest: "Interest",
  "other-income": "Other income",
};

export type Income = {
  id: ID;
  category: IncomeCategory;
  amount: Money;
  date: string;
  source: string;
  branch: string;
  description?: string;
  accountId?: ID;
  createdBy: string;
  createdAt: string;
};

export type ExpenseCategory =
  | "salaries"
  | "utilities"
  | "rent"
  | "maintenance"
  | "transport"
  | "academic-materials"
  | "laboratory"
  | "library"
  | "events"
  | "marketing"
  | "technology"
  | "training"
  | "travel"
  | "vendor-payments"
  | "taxes"
  | "other-expense";

export const expenseCategoryLabels: Record<ExpenseCategory, string> = {
  salaries: "Salaries",
  utilities: "Utilities",
  rent: "Rent",
  maintenance: "Maintenance",
  transport: "Transport",
  "academic-materials": "Academic materials",
  laboratory: "Laboratory",
  library: "Library",
  events: "Events",
  marketing: "Marketing",
  technology: "Technology",
  training: "Training",
  travel: "Travel",
  "vendor-payments": "Vendor payments",
  taxes: "Taxes",
  "other-expense": "Other expense",
};

export type ExpenseStatus = "draft" | "submitted" | "under-review" | "approved" | "rejected" | "paid" | "partially-paid" | "cancelled";

export const expenseStatusLabels: Record<ExpenseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  "under-review": "Under review",
  approved: "Approved",
  rejected: "Rejected",
  paid: "Paid",
  "partially-paid": "Partially paid",
  cancelled: "Cancelled",
};

export type Expense = {
  id: ID;
  expenseNumber: string;
  date: string;
  vendorId?: ID;
  category: ExpenseCategory;
  amount: Money;
  tax: Money;
  paymentMethod: PaymentMethod;
  accountId?: ID;
  branch: string;
  department?: string;
  costCentre?: string;
  description: string;
  attachmentName?: string;
  purchaseOrderId?: ID;
  status: ExpenseStatus;
  recurring: boolean;
  budgetLineId?: ID;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  paidAt?: string;
};

export type Vendor = {
  id: ID;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  taxNumber?: string;
  bankAccountNumber?: string;
  bankIfsc?: string;
  categories: ExpenseCategory[];
  status: "active" | "inactive";
  rating?: number;
  notes?: string;
  createdAt: string;
};

export type ChartOfAccountType = "asset" | "liability" | "equity" | "income" | "expense" | "bank" | "cash" | "receivable" | "payable";

export const chartOfAccountTypeLabels: Record<ChartOfAccountType, string> = {
  asset: "Asset",
  liability: "Liability",
  equity: "Equity",
  income: "Income",
  expense: "Expense",
  bank: "Bank",
  cash: "Cash",
  receivable: "Receivable",
  payable: "Payable",
};

export type ChartOfAccount = {
  id: ID;
  code: string;
  name: string;
  parentAccountId?: ID;
  type: ChartOfAccountType;
  openingBalance: Money;
  currency: CurrencyCode;
  branch: string;
  status: "active" | "inactive";
  description?: string;
};

export type JournalSourceType = "manual" | "fee-payment" | "refund" | "expense" | "payroll" | "adjustment" | "opening-balance";

export const journalSourceTypeLabels: Record<JournalSourceType, string> = {
  manual: "Manual journal",
  "fee-payment": "Fee payment",
  refund: "Refund",
  expense: "Expense",
  payroll: "Payroll",
  adjustment: "Adjustment",
  "opening-balance": "Opening balance",
};

/** One debit or credit line of a journal entry — exactly one of `debit`/
 * `credit` is non-zero on any given line. */
export type JournalLine = {
  id: ID;
  accountId: ID;
  debit: Money;
  credit: Money;
  description?: string;
};

export type JournalEntryStatus = "posted" | "reversed";

/** A balanced double-entry journal. Once `posted`, lines are immutable —
 * corrections are made with a new reversal entry (`reversalOfEntryId`),
 * never by editing or deleting a posted entry. */
export type JournalEntry = {
  id: ID;
  entryNumber: string;
  date: string;
  sourceType: JournalSourceType;
  sourceId?: ID;
  lines: JournalLine[];
  narration: string;
  status: JournalEntryStatus;
  reversalOfEntryId?: ID;
  postedBy: string;
  postedAt: string;
};

export type LedgerType = "account" | "student" | "parent" | "vendor" | "bank" | "cash";

/** One posted row of a ledger view — derived from JournalLines, never
 * written directly. `runningBalance` is computed in date order per ledger. */
export type LedgerEntry = {
  id: ID;
  ledgerType: LedgerType;
  ledgerRefId: ID;
  journalEntryId: ID;
  date: string;
  debit: Money;
  credit: Money;
  runningBalance: Money;
  reference: string;
  source: JournalSourceType;
};

export type BankAccount = {
  id: ID;
  accountId: ID;
  bankName: string;
  accountNumber: string;
  ifsc?: string;
  branch: string;
  currency: CurrencyCode;
  status: "active" | "inactive";
};

export type CashAccountType = "main" | "petty-cash";

export type CashAccount = {
  id: ID;
  accountId: ID;
  name: string;
  type: CashAccountType;
  branch: string;
  currency: CurrencyCode;
};

export type CashierShiftStatus = "open" | "closed";

/** One open→close cycle of a cashier's register. `difference` is the gap
 * between `expectedClosing` (opening + collections − refunds − expenses)
 * and what was physically counted — never silently absorbed. */
export type CashierShift = {
  id: ID;
  cashierName: string;
  branch: string;
  openedAt: string;
  closedAt?: string;
  openingCash: Money;
  cashCollections: Money;
  cashRefunds: Money;
  cashExpenses: Money;
  expectedClosing: Money;
  actualClosing?: Money;
  difference?: Money;
  notes?: string;
  status: CashierShiftStatus;
  approvedBy?: string;
};

