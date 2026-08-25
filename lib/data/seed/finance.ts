import type { ManagedClass, Teacher } from "@/lib/types/academics";
import type { Student } from "@/lib/types/students";
import type {
  Concession,
  Discount,
  FeeCategory,
  FeeComponent,
  FeeComponentType,
  FeeInstallment,
  FeeStructure,
  LateFeeRule,
  ReminderRule,
  Scholarship,
  StudentFeeAssignment,
  StudentFeeItem,
} from "@/lib/types/fees";
import { feeComponentTypeLabels } from "@/lib/types/fees";
import type { BankTransaction, Payment, PaymentAllocation, Receipt } from "@/lib/types/payments";
import type {
  BankAccount,
  CashAccount,
  ChartOfAccount,
  Expense,
  JournalEntry,
  Vendor,
} from "@/lib/types/accounting";
import type { PayrollEmployeeLine, PayrollRun, Payslip, SalaryStructure } from "@/lib/types/payroll";
import { addMoney, moneyFromMajor, multiplyMoney, splitEvenly, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { generateId } from "@/lib/utils";
import { CURRENT_SESSION } from "./reference";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(5082026);
export const BRANCH = "main";

// ---------------------------------------------------------------------------
// Chart of accounts, bank & cash accounts
// ---------------------------------------------------------------------------

const coaSeed: Omit<ChartOfAccount, "openingBalance" | "currency" | "branch" | "status">[] = [
  { id: "coa-cash", code: "1000", name: "Cash Account", type: "cash" },
  { id: "coa-bank", code: "1010", name: "Bank Account — Operating", type: "bank" },
  { id: "coa-receivable", code: "1100", name: "Accounts Receivable — Fees", type: "receivable" },
  { id: "coa-payable", code: "2000", name: "Accounts Payable — Vendors", type: "payable" },
  { id: "coa-salaries-payable", code: "2100", name: "Salaries Payable", type: "liability" },
  { id: "coa-tax-payable", code: "2200", name: "Tax Payable", type: "liability" },
  { id: "coa-equity", code: "3000", name: "Owner's Equity", type: "equity" },
  { id: "coa-income-tuition", code: "4000", name: "Tuition Fee Income", type: "income" },
  { id: "coa-income-transport", code: "4010", name: "Transport Fee Income", type: "income" },
  { id: "coa-income-other-fee", code: "4020", name: "Other Fee Income", type: "income" },
  { id: "coa-income-donations", code: "4030", name: "Donations & Grants", type: "income" },
  { id: "coa-expense-salaries", code: "5000", name: "Salaries Expense", type: "expense" },
  { id: "coa-expense-utilities", code: "5010", name: "Utilities Expense", type: "expense" },
  { id: "coa-expense-rent", code: "5020", name: "Rent Expense", type: "expense" },
  { id: "coa-expense-maintenance", code: "5030", name: "Maintenance Expense", type: "expense" },
  { id: "coa-expense-academic", code: "5040", name: "Academic Materials Expense", type: "expense" },
  { id: "coa-expense-marketing", code: "5050", name: "Marketing Expense", type: "expense" },
  { id: "coa-expense-technology", code: "5060", name: "Technology Expense", type: "expense" },
  { id: "coa-expense-other", code: "5070", name: "Other Expense", type: "expense" },
];

export const chartOfAccounts: ChartOfAccount[] = coaSeed.map((a) => ({
  ...a,
  openingBalance: zeroMoney("INR"),
  currency: "INR",
  branch: BRANCH,
  status: "active",
}));

export const bankAccounts: BankAccount[] = [
  { id: "bank-main", accountId: "coa-bank", bankName: "HDFC Bank", accountNumber: "50100123456789", ifsc: "HDFC0001234", branch: BRANCH, currency: "INR", status: "active" },
];

export const cashAccounts: CashAccount[] = [{ id: "cash-main", accountId: "coa-cash", name: "Main Cash Counter", type: "main", branch: BRANCH, currency: "INR" }];

// ---------------------------------------------------------------------------
// Fee categories — the 15 built-in component types, read-only registry rows
// ---------------------------------------------------------------------------

export const feeCategories: FeeCategory[] = (Object.keys(feeComponentTypeLabels) as FeeComponentType[]).map((type) => ({
  id: `cat-${type}`,
  name: feeComponentTypeLabels[type],
  componentType: type,
  builtIn: true,
  status: "active",
  createdAt: "2026-04-01T00:00:00.000Z",
}));

// ---------------------------------------------------------------------------
// Fee structures — one per class, quarterly installments
// ---------------------------------------------------------------------------

const installmentDueDates = ["2026-06-15", "2026-09-15", "2026-12-15", "2027-03-15"];

function buildComponents(classOrder: number): FeeComponent[] {
  const components: FeeComponent[] = [
    { id: generateId("fc"), type: "tuition", label: "Tuition fee", amount: moneyFromMajor(24000 + classOrder * 1400, "INR"), taxable: false, refundable: false, optional: false },
    { id: generateId("fc"), type: "annual", label: "Annual fee", amount: moneyFromMajor(6000, "INR"), taxable: false, refundable: false, optional: false },
    { id: generateId("fc"), type: "examination", label: "Examination fee", amount: moneyFromMajor(2400, "INR"), taxable: false, refundable: false, optional: false },
    { id: generateId("fc"), type: "development", label: "Development fee", amount: moneyFromMajor(3000, "INR"), taxable: false, refundable: false, optional: false },
    { id: generateId("fc"), type: "transport", label: "Transport fee", amount: moneyFromMajor(9600, "INR"), taxable: false, refundable: false, optional: true },
  ];
  if (classOrder >= 6) {
    components.push({ id: generateId("fc"), type: "laboratory", label: "Laboratory fee", amount: moneyFromMajor(2800, "INR"), taxable: false, refundable: false, optional: false });
  }
  return components;
}

function buildInstallments(total: Money): FeeInstallment[] {
  const shares = splitEvenly(total, installmentDueDates.length);
  return installmentDueDates.map((dueDate, i) => ({ id: generateId("fi"), label: `Installment ${i + 1}`, dueDate, amount: shares[i], componentIds: [] }));
}

export function buildFeeStructures(classes: ManagedClass[]): FeeStructure[] {
  return classes
    .filter((c) => c.status === "active")
    .map((c) => {
      const components = buildComponents(c.order);
      const total = sumMoney(
        components.filter((comp) => !comp.optional).map((comp) => comp.amount),
        "INR",
      );
      const now = new Date().toISOString();
      return {
        id: `fs-${c.id}`,
        name: `${c.name} — Standard`,
        session: CURRENT_SESSION,
        branch: BRANCH,
        applicableClassIds: [c.id],
        applicableSectionIds: [],
        admissionType: "all",
        components,
        frequency: "quarterly",
        installments: buildInstallments(total),
        gracePeriodDays: 10,
        lateFeeRuleId: "lfr-standard",
        discountCompatible: true,
        prorationRule: "monthly-prorated",
        currency: "INR",
        status: "active",
        version: 1,
        createdAt: now,
        updatedAt: now,
        createdBy: "Finance Administrator",
      } satisfies FeeStructure;
    });
}

export const lateFeeRules: LateFeeRule[] = [
  {
    id: "lfr-standard",
    name: "Standard late fee",
    calcType: "fixed",
    amount: moneyFromMajor(200, "INR"),
    gracePeriodDays: 10,
    maxCapAmount: moneyFromMajor(1000, "INR"),
    applicableComponentIds: [],
    applicableClassIds: [],
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

export const reminderRules: ReminderRule[] = [
  {
    id: "rem-before-due-7",
    name: "7 days before due",
    trigger: "before-due",
    offsetDays: 7,
    channels: ["in-app", "sms"],
    audience: "parent",
    templateEn: "Dear parent, {studentName}'s fee installment of {amount} is due on {dueDate}. Please pay on time to avoid a late fee.",
    templateHi: "प्रिय अभिभावक, {studentName} की फीस किस्त {amount} {dueDate} को देय है। कृपया समय पर भुगतान करें।",
    maxReminders: 1,
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rem-on-due",
    name: "On due date",
    trigger: "on-due",
    channels: ["in-app", "email", "sms"],
    audience: "parent",
    templateEn: "Dear parent, {studentName}'s fee installment of {amount} is due today.",
    templateHi: "प्रिय अभिभावक, {studentName} की फीस किस्त {amount} आज देय है।",
    maxReminders: 1,
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rem-overdue-15",
    name: "15 days overdue",
    trigger: "overdue",
    offsetDays: 15,
    channels: ["in-app", "email", "sms", "whatsapp"],
    audience: "both",
    templateEn: "Dear parent, {studentName}'s fee installment of {amount} is now 15 days overdue. A late fee may apply.",
    templateHi: "प्रिय अभिभावक, {studentName} की फीस किस्त {amount} अब 15 दिन से बकाया है। विलंब शुल्क लागू हो सकता है।",
    maxReminders: 3,
    retryIntervalHours: 72,
    escalateAfterCount: 3,
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
  {
    id: "rem-overdue-30",
    name: "30 days overdue",
    trigger: "overdue",
    offsetDays: 30,
    channels: ["in-app", "email", "sms", "whatsapp", "push"],
    audience: "both",
    templateEn: "Dear parent, {studentName}'s fee installment of {amount} is now 30 days overdue. Please contact the school office urgently.",
    maxReminders: 2,
    escalateAfterCount: 1,
    status: "active",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
  },
];

// ---------------------------------------------------------------------------
// Per-student fee assignments, items, payments, receipts and journals
// ---------------------------------------------------------------------------

export type FinanceSeedData = {
  studentFeeAssignments: StudentFeeAssignment[];
  studentFeeItems: StudentFeeItem[];
  payments: Payment[];
  paymentAllocations: PaymentAllocation[];
  receipts: Receipt[];
  discounts: Discount[];
  scholarships: Scholarship[];
  concessions: Concession[];
  journalEntries: JournalEntry[];
};

type Q1Profile = "paid" | "partial" | "overdue";

function pickQ1Profile(): Q1Profile {
  const roll = helpers.rand();
  if (roll < 0.55) return "paid";
  if (roll < 0.75) return "partial";
  return "overdue";
}

const incomeAccountForComponent: Record<string, string> = {
  tuition: "coa-income-tuition",
  annual: "coa-income-other-fee",
  examination: "coa-income-other-fee",
  development: "coa-income-other-fee",
  transport: "coa-income-transport",
  laboratory: "coa-income-other-fee",
  hostel: "coa-income-other-fee",
  library: "coa-income-other-fee",
  activity: "coa-income-other-fee",
  "smart-class": "coa-income-other-fee",
  registration: "coa-income-other-fee",
  admission: "coa-income-other-fee",
  "security-deposit": "coa-income-other-fee",
  "late-fee": "coa-income-other-fee",
  custom: "coa-income-other-fee",
};

function cashOrBankAccountId(method: Payment["method"]): string {
  return method === "cash" ? "coa-cash" : "coa-bank";
}

let receiptSequence = 1;
function nextReceiptNumber(): string {
  const number = `RC-2026-${String(receiptSequence).padStart(6, "0")}`;
  receiptSequence += 1;
  return number;
}

export function generateFinanceData(students: Student[], structures: FeeStructure[]): FinanceSeedData {
  const studentFeeAssignments: StudentFeeAssignment[] = [];
  const studentFeeItems: StudentFeeItem[] = [];
  const payments: Payment[] = [];
  const paymentAllocations: PaymentAllocation[] = [];
  const receipts: Receipt[] = [];
  const discounts: Discount[] = [];
  const scholarships: Scholarship[] = [];
  const concessions: Concession[] = [];
  const journalEntries: JournalEntry[] = [];

  const activeStudents = students.filter((s) => s.status === "active");
  let discountRecipientIndex = 0;

  for (const student of activeStudents) {
    const structure = structures.find((s) => s.applicableClassIds.includes(student.classId));
    if (!structure) continue;

    const assignment: StudentFeeAssignment = {
      id: generateId("sfa"),
      studentId: student.id,
      session: CURRENT_SESSION,
      structureId: structure.id,
      discountIds: [],
      scholarshipIds: [],
      optionalComponentIds: student.transport ? structure.components.filter((c) => c.type === "transport").map((c) => c.id) : [],
      status: "active",
      assignedAt: "2026-04-05T09:00:00.000Z",
      assignedBy: "Finance Administrator",
      notes: undefined,
    };
    studentFeeAssignments.push(assignment);

    // A small, stable subset of students carry a discount or scholarship —
    // applied by reducing their first-installment tuition item so the effect
    // is visible in both the ledger unit and the payment they made against it.
    let studentDiscount: Money | undefined;
    if (discountRecipientIndex < 3) {
      const amount = multiplyMoney(structure.components.find((c) => c.type === "tuition")!.amount, 0.1);
      discounts.push({
        id: generateId("disc"),
        name: "Sibling discount",
        type: "sibling",
        studentId: student.id,
        percent: 10,
        applicableComponentIds: [structure.components.find((c) => c.type === "tuition")!.id],
        session: CURRENT_SESSION,
        effectiveFrom: "2026-04-01T00:00:00.000Z",
        status: "active",
        approvedBy: "Finance Administrator",
        approvedAt: "2026-04-02T00:00:00.000Z",
        createdBy: "Finance Administrator",
        createdAt: "2026-04-01T00:00:00.000Z",
      });
      assignment.discountIds.push(discounts[discounts.length - 1].id);
      studentDiscount = multiplyMoney(amount, 0.25);
    } else if (discountRecipientIndex < 5) {
      const amount = multiplyMoney(structure.components.find((c) => c.type === "tuition")!.amount, 0.15);
      scholarships.push({
        id: generateId("schol"),
        name: "Academic merit scholarship",
        type: "merit",
        studentId: student.id,
        session: CURRENT_SESSION,
        percent: 15,
        applicableComponentIds: [structure.components.find((c) => c.type === "tuition")!.id],
        effectiveFrom: "2026-04-01T00:00:00.000Z",
        renewable: true,
        status: "active",
        approvedBy: "Principal",
        approvedAt: "2026-04-03T00:00:00.000Z",
        createdBy: "Finance Administrator",
        createdAt: "2026-04-01T00:00:00.000Z",
      });
      assignment.scholarshipIds.push(scholarships[scholarships.length - 1].id);
      studentDiscount = multiplyMoney(amount, 0.25);
    } else if (discountRecipientIndex === 5) {
      const amount = moneyFromMajor(2000, "INR");
      concessions.push({
        id: generateId("conc"),
        studentId: student.id,
        reason: "financial-hardship",
        description: "Approved by management following a hardship request.",
        amount,
        applicableComponentIds: [structure.components.find((c) => c.type === "tuition")!.id],
        effectiveFrom: "2026-04-01T00:00:00.000Z",
        status: "active",
        approvedBy: "Principal",
        approvedAt: "2026-04-04T00:00:00.000Z",
        createdBy: "Finance Administrator",
        createdAt: "2026-04-01T00:00:00.000Z",
      });
      studentDiscount = moneyFromMajor(500, "INR");
    }
    discountRecipientIndex += 1;

    const profile = pickQ1Profile();
    const paidComponentIds = new Set(assignment.optionalComponentIds);
    const componentsForStudent = structure.components.filter((c) => !c.optional || paidComponentIds.has(c.id));

    const paymentItemsForQ1: { item: StudentFeeItem; payAmount: Money }[] = [];

    structure.installments.forEach((installment, installmentIndex) => {
      for (const component of componentsForStudent) {
        const share = splitEvenly(component.amount, structure.installments.length)[installmentIndex];
        const isQ1 = installmentIndex === 0;
        const isTuition = component.type === "tuition";
        const discountAmount = isQ1 && isTuition && studentDiscount ? studentDiscount : zeroMoney("INR");
        const scholarshipAmount = zeroMoney("INR");
        const netDue = subtractMoney(share, addMoney(discountAmount, scholarshipAmount));

        let paidAmount = zeroMoney("INR");
        let fineAmount = zeroMoney("INR");
        let status: StudentFeeItem["status"] = "pending";

        if (isQ1) {
          if (profile === "paid") {
            paidAmount = netDue;
            status = "paid";
          } else if (profile === "partial") {
            paidAmount = multiplyMoney(netDue, 0.5);
            status = "partial";
          } else {
            fineAmount = moneyFromMajor(component.type === "tuition" ? 200 : 0, "INR");
            status = "overdue";
          }
        }

        const item: StudentFeeItem = {
          id: generateId("sfi"),
          assignmentId: assignment.id,
          studentId: student.id,
          session: CURRENT_SESSION,
          structureId: structure.id,
          componentId: component.id,
          componentType: component.type,
          installmentId: installment.id,
          label: `${component.label} — ${installment.label}`,
          billedAmount: share,
          discountAmount,
          scholarshipAmount,
          fineAmount,
          paidAmount,
          dueDate: installment.dueDate,
          status,
          refundable: component.refundable,
        };
        studentFeeItems.push(item);

        if (isQ1 && paidAmount.minorUnits > 0) {
          paymentItemsForQ1.push({ item, payAmount: paidAmount });
        }
      }
    });

    if (paymentItemsForQ1.length > 0) {
      const totalPaid = sumMoney(
        paymentItemsForQ1.map((p) => p.payAmount),
        "INR",
      );
      const method = helpers.pick(["upi", "cash", "card", "bank-transfer", "cheque"] as const);
      const paidAt = helpers.daysFromNowIso(-helpers.int(20, 55));
      const payment: Payment = {
        id: generateId("pay"),
        studentId: student.id,
        session: CURRENT_SESSION,
        amount: totalPaid,
        method,
        status: "successful",
        transactionReference: method === "cheque" ? `CHQ-${helpers.int(100000, 999999)}` : `TXN-${helpers.int(100000000, 999999999)}`,
        paidAt,
        branch: BRANCH,
        cashierName: "Priya Nair",
        receiptId: undefined,
        idempotencyKey: generateId("idem"),
        createdAt: paidAt,
      };
      payments.push(payment);

      for (const { item, payAmount } of paymentItemsForQ1) {
        paymentAllocations.push({ id: generateId("pa"), paymentId: payment.id, feeItemId: item.id, amount: payAmount });
      }

      const receipt: Receipt = {
        id: generateId("rcpt"),
        receiptNumber: nextReceiptNumber(),
        paymentId: payment.id,
        studentId: student.id,
        session: CURRENT_SESSION,
        branch: BRANCH,
        items: paymentItemsForQ1.map(({ item, payAmount }) => ({ label: item.label, amount: payAmount })),
        method,
        amount: totalPaid,
        discount: studentDiscount ?? zeroMoney("INR"),
        fine: zeroMoney("INR"),
        tax: zeroMoney("INR"),
        total: totalPaid,
        issuedAt: paidAt,
        cashierName: "Priya Nair",
        status: "issued",
      };
      receipts.push(receipt);
      payment.receiptId = receipt.id;

      journalEntries.push({
        id: generateId("je"),
        entryNumber: `JE-${String(journalEntries.length + 1).padStart(6, "0")}`,
        date: paidAt,
        sourceType: "fee-payment",
        sourceId: payment.id,
        narration: `Fee payment received from ${student.profile.firstName} ${student.profile.lastName} — receipt ${receipt.receiptNumber}`,
        lines: [
          { id: generateId("jl"), accountId: cashOrBankAccountId(method), debit: totalPaid, credit: zeroMoney("INR") },
          { id: generateId("jl"), accountId: incomeAccountForComponent.tuition, debit: zeroMoney("INR"), credit: totalPaid },
        ],
        status: "posted",
        postedBy: "Priya Nair",
        postedAt: paidAt,
      });
    }
  }

  return { studentFeeAssignments, studentFeeItems, payments, paymentAllocations, receipts, discounts, scholarships, concessions, journalEntries };
}

// ---------------------------------------------------------------------------
// Vendors, purchase orders, expenses, budget
// ---------------------------------------------------------------------------

export const vendors: Vendor[] = [
  { id: "vendor-1", name: "Bright Stationers Pvt Ltd", contactPerson: "Ramesh Gupta", phone: "9845012345", email: "sales@brightstationers.example", categories: ["academic-materials"], status: "active", rating: 4, createdAt: "2025-06-01T00:00:00.000Z" },
  { id: "vendor-2", name: "PowerGrid Utilities", contactPerson: "Billing Desk", phone: "1800123456", categories: ["utilities"], status: "active", rating: 5, createdAt: "2025-06-01T00:00:00.000Z" },
  { id: "vendor-3", name: "CleanCampus Facility Services", contactPerson: "Suresh Kumar", phone: "9845098765", categories: ["maintenance"], status: "active", rating: 4, createdAt: "2025-06-01T00:00:00.000Z" },
  { id: "vendor-4", name: "TechEdge Solutions", contactPerson: "Anita Rao", phone: "9845011223", email: "support@techedge.example", categories: ["technology"], status: "active", rating: 4, createdAt: "2025-06-01T00:00:00.000Z" },
  { id: "vendor-5", name: "Horizon Transport Co.", contactPerson: "Manoj Singh", phone: "9845033445", categories: ["transport"], status: "active", rating: 3, createdAt: "2025-06-01T00:00:00.000Z" },
];

export const expenses: Expense[] = [
  { id: "exp-1", expenseNumber: "EXP-2026-0001", date: "2026-07-05", vendorId: "vendor-2", category: "utilities", amount: moneyFromMajor(42500, "INR"), tax: zeroMoney("INR"), paymentMethod: "bank-transfer", accountId: "coa-expense-utilities", branch: BRANCH, department: "Facilities", description: "July electricity bill", status: "paid", recurring: true, createdBy: "Accountant", createdAt: "2026-07-05T00:00:00.000Z", approvedBy: "Finance Administrator", approvedAt: "2026-07-05T00:00:00.000Z", paidAt: "2026-07-06T00:00:00.000Z" },
  { id: "exp-2", expenseNumber: "EXP-2026-0002", date: "2026-07-10", vendorId: "vendor-3", category: "maintenance", amount: moneyFromMajor(28000, "INR"), tax: zeroMoney("INR"), paymentMethod: "bank-transfer", accountId: "coa-expense-maintenance", branch: BRANCH, department: "Facilities", description: "Monthly campus housekeeping contract", status: "paid", recurring: true, createdBy: "Accountant", createdAt: "2026-07-10T00:00:00.000Z", approvedBy: "Finance Administrator", approvedAt: "2026-07-10T00:00:00.000Z", paidAt: "2026-07-11T00:00:00.000Z" },
  { id: "exp-3", expenseNumber: "EXP-2026-0003", date: "2026-07-18", vendorId: "vendor-4", category: "technology", amount: moneyFromMajor(65000, "INR"), tax: moneyFromMajor(11700, "INR"), paymentMethod: "bank-transfer", accountId: "coa-expense-technology", branch: BRANCH, department: "IT", description: "Smart-class projector replacement (3 units)", status: "paid", recurring: false, createdBy: "Accountant", createdAt: "2026-07-18T00:00:00.000Z", approvedBy: "Principal", approvedAt: "2026-07-19T00:00:00.000Z", paidAt: "2026-07-20T00:00:00.000Z" },
  { id: "exp-4", expenseNumber: "EXP-2026-0004", date: "2026-07-22", category: "rent", amount: moneyFromMajor(150000, "INR"), tax: zeroMoney("INR"), paymentMethod: "bank-transfer", accountId: "coa-expense-rent", branch: BRANCH, department: "Facilities", description: "Monthly campus lease", status: "paid", recurring: true, createdBy: "Accountant", createdAt: "2026-07-22T00:00:00.000Z", approvedBy: "Finance Administrator", approvedAt: "2026-07-22T00:00:00.000Z", paidAt: "2026-07-22T00:00:00.000Z" },
  { id: "exp-5", expenseNumber: "EXP-2026-0005", date: "2026-08-01", vendorId: "vendor-1", category: "academic-materials", amount: moneyFromMajor(48600, "INR"), tax: moneyFromMajor(5832, "INR"), paymentMethod: "cheque", accountId: "coa-expense-academic", branch: BRANCH, department: "Academics", description: "Stationery bulk order — PO-2026-0001", purchaseOrderId: "po-1", status: "under-review", recurring: false, createdBy: "Accountant", createdAt: "2026-08-01T00:00:00.000Z" },
  { id: "exp-6", expenseNumber: "EXP-2026-0006", date: "2026-08-03", category: "marketing", amount: moneyFromMajor(22000, "INR"), tax: zeroMoney("INR"), paymentMethod: "card", accountId: "coa-expense-marketing", branch: BRANCH, department: "Admissions", description: "Admission-season social media campaign", status: "submitted", recurring: false, createdBy: "Accountant", createdAt: "2026-08-03T00:00:00.000Z" },
  { id: "exp-7", expenseNumber: "EXP-2026-0007", date: "2026-08-04", category: "travel", amount: moneyFromMajor(12500, "INR"), tax: zeroMoney("INR"), paymentMethod: "cash", branch: BRANCH, department: "Academics", description: "Inter-school sports meet travel", status: "draft", recurring: false, createdBy: "Accountant", createdAt: "2026-08-04T00:00:00.000Z" },
];

const expenseJournalEntries: JournalEntry[] = expenses
  .filter((e) => e.status === "paid")
  .map((e, i) => ({
    id: generateId("je"),
    entryNumber: `JE-EXP-${String(i + 1).padStart(6, "0")}`,
    date: e.paidAt ?? e.date,
    sourceType: "expense" as const,
    sourceId: e.id,
    narration: `${e.expenseNumber} — ${e.description}`,
    lines: [
      { id: generateId("jl"), accountId: e.accountId ?? "coa-expense-other", debit: addMoney(e.amount, e.tax), credit: zeroMoney("INR") },
      { id: generateId("jl"), accountId: cashOrBankAccountId(e.paymentMethod), debit: zeroMoney("INR"), credit: addMoney(e.amount, e.tax) },
    ],
    status: "posted" as const,
    postedBy: "Accountant",
    postedAt: e.paidAt ?? e.date,
  }));

export function expenseJournals(): JournalEntry[] {
  return expenseJournalEntries;
}

// ---------------------------------------------------------------------------
// Payroll — salary structures, one completed run for the prior month, payslips
// ---------------------------------------------------------------------------

export function buildSalaryStructures(teachers: Teacher[]): SalaryStructure[] {
  return teachers.slice(0, 8).map((teacher, index) => {
    const basic = moneyFromMajor(38000 + (index % 5) * 6000, "INR");
    const basicComponentId = generateId("sc");
    return {
      id: generateId("sal"),
      name: `${teacher.name} — Standard structure`,
      employeeId: teacher.id,
      session: CURRENT_SESSION,
      components: [
        { id: basicComponentId, name: "Basic", category: "earning", calcType: "fixed", amount: basic, taxable: true, recurring: true },
        { id: generateId("sc"), name: "HRA", category: "earning", calcType: "percentage", percent: 40, percentOfComponentId: basicComponentId, taxable: true, recurring: true },
        { id: generateId("sc"), name: "Provident Fund", category: "deduction", calcType: "percentage", percent: 12, percentOfComponentId: basicComponentId, taxable: false, recurring: true },
        { id: generateId("sc"), name: "Professional Tax", category: "deduction", calcType: "fixed", amount: moneyFromMajor(200, "INR"), taxable: false, recurring: true },
      ],
      currency: "INR",
      effectiveFrom: "2026-04-01",
      status: "active",
      createdAt: "2026-04-01T00:00:00.000Z",
      updatedAt: "2026-04-01T00:00:00.000Z",
    } satisfies SalaryStructure;
  });
}

export function buildPayrollForJuly(structures: SalaryStructure[], teachers: Teacher[]): { run: PayrollRun; payslips: Payslip[]; journal: JournalEntry } {
  const workingDays = 26;
  const employees: PayrollEmployeeLine[] = [];
  const payslips: Payslip[] = [];

  for (const structure of structures) {
    const teacher = teachers.find((t) => t.id === structure.employeeId);
    if (!teacher) continue;
    const basicComponent = structure.components.find((c) => c.name === "Basic")!;
    const basic = basicComponent.amount!;
    const hra = multiplyMoney(basic, 0.4);
    const attendanceDays = workingDays - helpers.int(0, 2);
    const gross = addMoney(basic, hra);
    const pf = multiplyMoney(basic, 0.12);
    const professionalTax = moneyFromMajor(200, "INR");
    const totalDeductions = addMoney(pf, professionalTax);
    const netPay = subtractMoney(gross, totalDeductions);

    const payslip: Payslip = {
      id: generateId("pslip"),
      payrollRunId: "payroll-2026-07",
      employeeId: teacher.id,
      employeeName: teacher.name,
      period: "2026-07",
      earnings: [
        { label: "Basic", amount: basic },
        { label: "HRA", amount: hra },
      ],
      deductions: [
        { label: "Provident Fund", amount: pf },
        { label: "Professional Tax", amount: professionalTax },
      ],
      grossPay: gross,
      netPay,
      attendanceDays,
      workingDays,
      leaveDays: workingDays - attendanceDays,
      generatedAt: "2026-08-01T00:00:00.000Z",
      version: 1,
    };
    payslips.push(payslip);

    employees.push({
      id: generateId("prl"),
      employeeId: teacher.id,
      employeeName: teacher.name,
      structureId: structure.id,
      grossPay: gross,
      totalDeductions,
      netPay,
      attendanceDays,
      workingDays,
      loanDeduction: zeroMoney("INR"),
      advanceDeduction: zeroMoney("INR"),
      taxDeducted: zeroMoney("INR"),
      exceptions: [],
      payslipId: payslip.id,
    });
  }

  const totalGross = sumMoney(employees.map((e) => e.grossPay), "INR");
  const totalDeductions = sumMoney(employees.map((e) => e.totalDeductions), "INR");
  const totalNet = sumMoney(employees.map((e) => e.netPay), "INR");

  const run: PayrollRun = {
    id: "payroll-2026-07",
    period: "2026-07",
    branch: BRANCH,
    status: "paid",
    employees,
    totalGross,
    totalDeductions,
    totalNet,
    createdBy: "Finance Administrator",
    createdAt: "2026-07-28T00:00:00.000Z",
    approvedBy: "Principal",
    approvedAt: "2026-07-29T00:00:00.000Z",
    lockedAt: "2026-07-29T00:00:00.000Z",
    paidAt: "2026-08-01T00:00:00.000Z",
    journalEntryId: "je-payroll-2026-07",
  };

  const journal: JournalEntry = {
    id: "je-payroll-2026-07",
    entryNumber: "JE-PAY-000001",
    date: "2026-08-01T00:00:00.000Z",
    sourceType: "payroll",
    sourceId: run.id,
    narration: `Payroll for ${run.period} — ${employees.length} employee(s)`,
    lines: [
      { id: generateId("jl"), accountId: "coa-expense-salaries", debit: totalGross, credit: zeroMoney("INR") },
      { id: generateId("jl"), accountId: "coa-tax-payable", debit: zeroMoney("INR"), credit: totalDeductions },
      { id: generateId("jl"), accountId: "coa-bank", debit: zeroMoney("INR"), credit: totalNet },
    ],
    status: "posted",
    postedBy: "Finance Administrator",
    postedAt: "2026-08-01T00:00:00.000Z",
  };

  return { run, payslips, journal };
}

// ---------------------------------------------------------------------------
// Bank transactions — a small illustrative "imported statement" to reconcile
// against the payments already recorded, so the reconciliation workspace
// isn't empty on first load.
// ---------------------------------------------------------------------------

const sourceForMethod: Record<string, BankTransaction["source"]> = {
  upi: "upi-settlement",
  card: "gateway-settlement",
  "online-gateway": "gateway-settlement",
  "bank-transfer": "bank-statement",
  cheque: "cheque-register",
  "demand-draft": "cheque-register",
};

export function generateBankTransactions(payments: Payment[]): BankTransaction[] {
  const nonCash = payments.filter((p) => p.method !== "cash" && sourceForMethod[p.method]);
  const matched = helpers.pickMany(nonCash, Math.min(8, nonCash.length));
  const transactions: BankTransaction[] = matched.map((p) => ({
    id: generateId("btx"),
    source: sourceForMethod[p.method],
    amount: p.amount,
    date: p.paidAt,
    reference: p.transactionReference ?? `SETL-${p.id.slice(-6)}`,
    description: `Settlement for ${p.method} payment`,
    importedAt: "2026-08-05T06:00:00.000Z",
  }));

  // Two "mystery" transactions with no matching payment — e.g. a parent's
  // direct transfer the office hasn't recorded yet.
  transactions.push(
    { id: generateId("btx"), source: "bank-statement", amount: moneyFromMajor(4200, "INR"), date: "2026-08-01", reference: "NEFT-88213", description: "Unidentified credit", importedAt: "2026-08-05T06:00:00.000Z" },
    { id: generateId("btx"), source: "upi-settlement", amount: moneyFromMajor(1850, "INR"), date: "2026-08-03", reference: "UPI-55210", description: "Unidentified credit", importedAt: "2026-08-05T06:00:00.000Z" },
  );

  // One duplicate of an already-matched transaction, to demonstrate duplicate detection.
  if (transactions.length > 0) {
    const dup = transactions[0];
    transactions.push({ ...dup, id: generateId("btx"), description: `${dup.description} (possible duplicate)` });
  }

  return transactions;
}
