import { getSnapshot, setState, type Db } from "@/lib/data/store";
import type { Payment, PaymentAllocation, PaymentGatewayProvider, PaymentGatewayStatus, PaymentMethod, Receipt, ReceiptLineItem } from "@/lib/types/payments";
import type { StudentFeeItem } from "@/lib/types/fees";
import { addMoney, compareMoney, isNegative, isZero, subtractMoney, sumMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { outstandingForItem } from "@/lib/selectors/fee-item-insights";
import { generateId } from "@/lib/utils";
import { logFinancialAudit } from "./finance-audit-service";

export type RecordPaymentInput = {
  studentId: string;
  itemIds: string[];
  amount: Money;
  method: PaymentMethod;
  transactionReference?: string;
  chequeNumber?: string;
  chequeDate?: string;
  bankName?: string;
  note?: string;
  paidAt?: string;
  allowAdvance?: boolean;
  branch: string;
  cashierName: string;
  idempotencyKey: string;
  gatewayProvider?: PaymentGatewayProvider;
  gatewayStatus?: PaymentGatewayStatus;
  gatewayPaymentId?: string;
};

export function nextReceiptNumber(db: Db): string {
  const year = new Date().getFullYear();
  const existingNumbers = db.receipts.map((r) => r.receiptNumber).filter((n) => n.startsWith(`RC-${year}-`));
  const maxSeq = existingNumbers.reduce((max, n) => {
    const seq = Number(n.split("-")[2]);
    return Number.isFinite(seq) && seq > max ? seq : max;
  }, 0);
  return `RC-${year}-${String(maxSeq + 1).padStart(6, "0")}`;
}

export function validatePaymentInput(db: Db, input: RecordPaymentInput): string[] {
  const errors: string[] = [];

  if (isNegative(input.amount) || isZero(input.amount)) errors.push("Payment amount must be greater than zero.");

  const student = db.students.find((s) => s.id === input.studentId);
  if (!student) errors.push("Student not found.");
  else if (student.status === "archived") errors.push("Cannot record a payment against an archived student.");

  if (input.itemIds.length === 0) errors.push("Select at least one fee item to pay against.");
  const items = db.studentFeeItems.filter((i) => input.itemIds.includes(i.id));
  if (items.some((i) => i.studentId !== input.studentId)) errors.push("Selected fee items do not all belong to this student.");
  if (items.some((i) => i.status === "cancelled")) errors.push("One or more selected fee items has been cancelled.");

  if (input.transactionReference) {
    const duplicate = db.payments.some((p) => p.transactionReference === input.transactionReference && p.status !== "failed" && p.status !== "cancelled");
    if (duplicate) errors.push(`Transaction reference "${input.transactionReference}" has already been used.`);
  }

  if (input.method === "cheque" || input.method === "demand-draft") {
    if (!input.chequeNumber) errors.push(`${input.method === "cheque" ? "Cheque" : "DD"} number is required for this payment method.`);
    if (!input.chequeDate) errors.push(`${input.method === "cheque" ? "Cheque" : "DD"} date is required for this payment method.`);
  }

  if (input.paidAt) {
    const paidAtDate = new Date(input.paidAt);
    if (Number.isNaN(paidAtDate.getTime())) errors.push("Payment date is invalid.");
    else if (paidAtDate.getTime() > Date.now() + 24 * 60 * 60 * 1000) errors.push("Payment date cannot be in the future.");
  }

  if (items.length > 0) {
    if (items.some((i) => i.billedAmount.currency !== input.amount.currency)) {
      errors.push(`Payment currency (${input.amount.currency}) does not match the fee items' currency.`);
    } else {
      const totalOutstanding = sumMoney(items.map((i) => outstandingForItem(i)), input.amount.currency);
      if (!input.allowAdvance && compareMoney(input.amount, totalOutstanding) > 0) {
        errors.push("Payment amount exceeds the amount due — enable advance payment to allow this.");
      }
    }
  }

  return errors;
}

export type RecordPaymentResult = { ok: true; payment: Payment; receipt: Receipt } | { ok: false; errors: string[] };

/** Allocates a payment amount across the selected fee items in order (each
 * item's outstanding is filled before moving to the next), so a partial
 * payment always settles the oldest-selected items first rather than
 * spreading thinly and leaving everything "partial". */
function allocateAcrossItems(items: StudentFeeItem[], amount: Money): { itemId: string; amount: Money; newPaidAmount: Money; newStatus: StudentFeeItem["status"] }[] {
  let remaining = amount;
  const allocations: { itemId: string; amount: Money; newPaidAmount: Money; newStatus: StudentFeeItem["status"] }[] = [];

  for (const item of items) {
    if (isZero(remaining)) break;
    const due = outstandingForItem(item);
    if (isZero(due)) continue;
    const applied = compareMoney(remaining, due) >= 0 ? due : remaining;
    remaining = subtractMoney(remaining, applied);
    const newPaidAmount = addMoney(item.paidAmount, applied);
    const netDueTotal = addMoney(subtractMoney(item.billedAmount, addMoney(item.discountAmount, item.scholarshipAmount)), item.fineAmount);
    const newStatus: StudentFeeItem["status"] = compareMoney(newPaidAmount, netDueTotal) >= 0 ? "paid" : "partial";
    allocations.push({ itemId: item.id, amount: applied, newPaidAmount, newStatus });
  }

  // Any leftover beyond what the selected items owed is a genuine advance —
  // recorded as a credit balance by the caller, never silently dropped.
  return allocations;
}

export function recordPayment(input: RecordPaymentInput, actor: { name: string; role: string }): RecordPaymentResult {
  const db = getSnapshot();

  const existingByIdempotency = db.payments.find((p) => p.idempotencyKey === input.idempotencyKey);
  if (existingByIdempotency) {
    const receipt = db.receipts.find((r) => r.paymentId === existingByIdempotency.id);
    if (receipt) return { ok: true, payment: existingByIdempotency, receipt };
  }

  const errors = validatePaymentInput(db, input);
  if (errors.length > 0) return { ok: false, errors };

  const items = db.studentFeeItems.filter((i) => input.itemIds.includes(i.id)).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const totalOutstanding = sumMoney(items.map((i) => outstandingForItem(i)), input.amount.currency);
  const amountAgainstItems = compareMoney(input.amount, totalOutstanding) > 0 ? totalOutstanding : input.amount;
  const advanceAmount = subtractMoney(input.amount, amountAgainstItems);
  const allocations = allocateAcrossItems(items, amountAgainstItems);

  const now = new Date().toISOString();
  const paidAt = input.paidAt ?? now;

  const payment: Payment = {
    id: generateId("pay"),
    studentId: input.studentId,
    session: items[0]?.session ?? db.students.find((s) => s.id === input.studentId)?.session ?? "",
    amount: input.amount,
    method: input.method,
    status: "successful",
    transactionReference: input.transactionReference,
    chequeNumber: input.chequeNumber,
    chequeDate: input.chequeDate,
    bankName: input.bankName,
    paidAt,
    branch: input.branch,
    cashierName: input.cashierName,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    gatewayProvider: input.gatewayProvider,
    gatewayStatus: input.gatewayStatus,
    gatewayPaymentId: input.gatewayPaymentId,
    createdAt: now,
  };

  const paymentAllocations: PaymentAllocation[] = allocations.map((a) => ({ id: generateId("pa"), paymentId: payment.id, feeItemId: a.itemId, amount: a.amount }));

  const receiptItems: ReceiptLineItem[] = allocations.map((a) => {
    const item = items.find((i) => i.id === a.itemId)!;
    return { label: item.label, amount: a.amount };
  });
  if (!isZero(advanceAmount)) receiptItems.push({ label: "Advance payment", amount: advanceAmount });

  const receipt: Receipt = {
    id: generateId("rcpt"),
    receiptNumber: nextReceiptNumber(db),
    paymentId: payment.id,
    studentId: input.studentId,
    session: payment.session,
    branch: input.branch,
    items: receiptItems,
    method: input.method,
    amount: input.amount,
    discount: zeroMoney(input.amount.currency),
    fine: zeroMoney(input.amount.currency),
    tax: zeroMoney(input.amount.currency),
    total: input.amount,
    issuedAt: paidAt,
    cashierName: input.cashierName,
    notes: input.note,
    status: "issued",
  };
  payment.receiptId = receipt.id;

  setState((current) => ({
    ...current,
    payments: [...current.payments, payment],
    paymentAllocations: [...current.paymentAllocations, ...paymentAllocations],
    receipts: [...current.receipts, receipt],
    studentFeeItems: current.studentFeeItems.map((item) => {
      const allocation = allocations.find((a) => a.itemId === item.id);
      return allocation ? { ...item, paidAmount: allocation.newPaidAmount, status: allocation.newStatus } : item;
    }),
    creditBalances: isZero(advanceAmount)
      ? current.creditBalances
      : [...current.creditBalances, { id: generateId("credit"), studentId: input.studentId, amount: advanceAmount, consumedAmount: zeroMoney(advanceAmount.currency), source: "overpayment" as const, note: "Advance payment", createdAt: now }],
  }));

  logFinancialAudit({
    subjectId: input.studentId,
    action: "payment-recorded",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `Payment of ${input.amount.minorUnits / 100} recorded via ${input.method} — receipt ${receipt.receiptNumber}.`,
    session: payment.session,
    branch: input.branch,
  });
  logFinancialAudit({
    subjectId: input.studentId,
    action: "receipt-issued",
    actorName: actor.name,
    actorRole: actor.role,
    summary: `Receipt ${receipt.receiptNumber} issued.`,
    session: payment.session,
    branch: input.branch,
  });

  return { ok: true, payment, receipt };
}

/** Applies a student's available credit balance toward selected fee items —
 * a distinct action from recordPayment since no money changes hands, only
 * an existing balance is consumed. */
export function applyCreditToPayment(studentId: string, itemIds: string[], amount: Money, actor: { name: string; role: string }): RecordPaymentResult {
  const db = getSnapshot();
  const available = sumMoney(
    db.creditBalances.filter((c) => c.studentId === studentId).map((c) => subtractMoney(c.amount, c.consumedAmount)),
    amount.currency,
  );
  if (compareMoney(amount, available) > 0) return { ok: false, errors: ["Amount exceeds the student's available credit balance."] };

  const items = db.studentFeeItems.filter((i) => itemIds.includes(i.id)).sort((a, b) => (a.dueDate < b.dueDate ? -1 : 1));
  const allocations = allocateAcrossItems(items, amount);
  const now = new Date().toISOString();

  const payment: Payment = {
    id: generateId("pay"),
    studentId,
    session: items[0]?.session ?? "",
    amount,
    method: "credit-adjustment",
    status: "successful",
    paidAt: now,
    branch: db.creditBalances.find((c) => c.studentId === studentId)?.id ? "main" : "main",
    cashierName: actor.name,
    idempotencyKey: generateId("idem"),
    createdAt: now,
  };
  const paymentAllocations: PaymentAllocation[] = allocations.map((a) => ({ id: generateId("pa"), paymentId: payment.id, feeItemId: a.itemId, amount: a.amount }));
  const receipt: Receipt = {
    id: generateId("rcpt"),
    receiptNumber: nextReceiptNumber(db),
    paymentId: payment.id,
    studentId,
    session: payment.session,
    branch: payment.branch,
    items: allocations.map((a) => ({ label: items.find((i) => i.id === a.itemId)!.label, amount: a.amount })),
    method: "credit-adjustment",
    amount,
    discount: zeroMoney(amount.currency),
    fine: zeroMoney(amount.currency),
    tax: zeroMoney(amount.currency),
    total: amount,
    issuedAt: now,
    cashierName: actor.name,
    status: "issued",
  };
  payment.receiptId = receipt.id;

  let remainingToConsume = amount;
  setState((current) => ({
    ...current,
    payments: [...current.payments, payment],
    paymentAllocations: [...current.paymentAllocations, ...paymentAllocations],
    receipts: [...current.receipts, receipt],
    studentFeeItems: current.studentFeeItems.map((item) => {
      const allocation = allocations.find((a) => a.itemId === item.id);
      return allocation ? { ...item, paidAmount: allocation.newPaidAmount, status: allocation.newStatus } : item;
    }),
    creditBalances: current.creditBalances.map((c) => {
      if (c.studentId !== studentId || isZero(remainingToConsume)) return c;
      const consumable = subtractMoney(c.amount, c.consumedAmount);
      const toConsume = compareMoney(remainingToConsume, consumable) >= 0 ? consumable : remainingToConsume;
      remainingToConsume = subtractMoney(remainingToConsume, toConsume);
      return { ...c, consumedAmount: addMoney(c.consumedAmount, toConsume) };
    }),
  }));

  logFinancialAudit({ subjectId: studentId, action: "payment-recorded", actorName: actor.name, actorRole: actor.role, summary: `Credit balance of ${amount.minorUnits / 100} applied — receipt ${receipt.receiptNumber}.` });
  return { ok: true, payment, receipt };
}
