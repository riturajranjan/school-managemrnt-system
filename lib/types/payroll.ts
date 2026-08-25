import type { ID } from "./common";
import type { CurrencyCode, Money } from "@/lib/finance/money";

export type SalaryComponentCategory = "earning" | "deduction";

export type SalaryComponentCalcType = "fixed" | "percentage" | "formula" | "attendance-based" | "one-time";

export const salaryComponentCalcTypeLabels: Record<SalaryComponentCalcType, string> = {
  fixed: "Fixed",
  percentage: "Percentage",
  formula: "Formula-based",
  "attendance-based": "Attendance-based",
  "one-time": "One-time",
};

export type SalaryComponent = {
  id: ID;
  name: string;
  category: SalaryComponentCategory;
  calcType: SalaryComponentCalcType;
  amount?: Money;
  percent?: number;
  /** Which component `percent` is a share of (e.g. HRA as 40% of Basic). */
  percentOfComponentId?: ID;
  taxable: boolean;
  recurring: boolean;
};

export type SalaryStructure = {
  id: ID;
  name: string;
  employeeId: ID;
  session: string;
  components: SalaryComponent[];
  currency: CurrencyCode;
  effectiveFrom: string;
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
};

export type PayrollRunStatus = "draft" | "calculating" | "review" | "approved" | "locked" | "paid" | "partially-paid" | "cancelled";

export const payrollRunStatusLabels: Record<PayrollRunStatus, string> = {
  draft: "Draft",
  calculating: "Calculating",
  review: "Review",
  approved: "Approved",
  locked: "Locked",
  paid: "Paid",
  "partially-paid": "Partially paid",
  cancelled: "Cancelled",
};

export type PayrollEmployeeException =
  | "missing-attendance"
  | "missing-salary-structure"
  | "negative-net-pay"
  | "excess-deduction"
  | "bank-details-missing"
  | "duplicate-payroll"
  | "loan-mismatch"
  | "tax-configuration-missing";

export const payrollEmployeeExceptionLabels: Record<PayrollEmployeeException, string> = {
  "missing-attendance": "Missing attendance",
  "missing-salary-structure": "Missing salary structure",
  "negative-net-pay": "Negative net pay",
  "excess-deduction": "Excess deduction",
  "bank-details-missing": "Bank details missing",
  "duplicate-payroll": "Duplicate payroll entry",
  "loan-mismatch": "Loan mismatch",
  "tax-configuration-missing": "Tax configuration missing",
};

export type PayrollEmployeeLine = {
  id: ID;
  employeeId: ID;
  employeeName: string;
  structureId?: ID;
  grossPay: Money;
  totalDeductions: Money;
  netPay: Money;
  attendanceDays: number;
  workingDays: number;
  loanDeduction: Money;
  advanceDeduction: Money;
  taxDeducted: Money;
  exceptions: PayrollEmployeeException[];
  payslipId?: ID;
};

export type PayrollRun = {
  id: ID;
  period: string;
  branch: string;
  status: PayrollRunStatus;
  employees: PayrollEmployeeLine[];
  totalGross: Money;
  totalDeductions: Money;
  totalNet: Money;
  createdBy: string;
  createdAt: string;
  approvedBy?: string;
  approvedAt?: string;
  lockedAt?: string;
  paidAt?: string;
  journalEntryId?: ID;
};

export type PayslipLineItem = { label: string; amount: Money };

export type Payslip = {
  id: ID;
  payrollRunId: ID;
  employeeId: ID;
  employeeName: string;
  period: string;
  earnings: PayslipLineItem[];
  deductions: PayslipLineItem[];
  grossPay: Money;
  netPay: Money;
  attendanceDays: number;
  workingDays: number;
  leaveDays: number;
  bankAccountLast4?: string;
  generatedAt: string;
  version: number;
};

