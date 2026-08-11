// Super Admin Phase SA-4D seed — a few real invoices on the seeded ACTIVE
// subscription across DISTINCT past periods (the one-invoice-per-period unique
// constraint forbids duplicates within a period). Demonstrates PAID + OPEN
// (derived overdue) states. Money is Decimal; invoice numbers come from the
// same sequence the app uses. Idempotent: skips if the subscription already has
// invoices.
import type { PrismaClient } from "../lib/generated/prisma/client";
import type { InvoiceStatus } from "../lib/generated/prisma/enums";

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, last));
  return d;
}

async function nextInvoiceNumber(prisma: PrismaClient, year: number): Promise<string> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('invoice_number_seq') AS nextval`;
  return `INV-${year}-${String(Number(rows[0].nextval)).padStart(6, "0")}`;
}

export async function seedInvoices(prisma: PrismaClient) {
  const sub = await prisma.subscription.findFirst({
    where: { status: "ACTIVE" },
    select: { id: true, tenantId: true, schoolId: true, currency: true, priceAmount: true, billingInterval: true, plan: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
  if (!sub) {
    console.log("  SA-4D:    Invoice seed skipped (no ACTIVE subscription)");
    return;
  }
  const existing = await prisma.invoice.findFirst({ where: { subscriptionId: sub.id }, select: { id: true } });
  if (existing) {
    const total = await prisma.invoice.count();
    console.log(`  SA-4D:    Invoice=${total} (+0)`);
    return;
  }

  const now = new Date();
  const price = sub.priceAmount;
  const description = `${sub.plan.name} subscription (${sub.billingInterval.toLowerCase()})`;

  const specs: { status: InvoiceStatus; startOffset: number; overdue?: boolean; paid?: boolean }[] = [
    { status: "PAID", startOffset: -3, paid: true },
    { status: "OPEN", startOffset: -2, overdue: true },
  ];

  let created = 0;
  for (const spec of specs) {
    const periodStart = addMonthsUtc(now, spec.startOffset);
    const periodEnd = addMonthsUtc(periodStart, 1);
    const invoiceNumber = await nextInvoiceNumber(prisma, periodStart.getUTCFullYear());
    await prisma.invoice.create({
      data: {
        invoiceNumber,
        tenantId: sub.tenantId,
        schoolId: sub.schoolId,
        subscriptionId: sub.id,
        status: spec.status,
        currency: sub.currency,
        subtotal: price,
        taxAmount: 0,
        discountAmount: 0,
        totalAmount: price,
        amountPaid: spec.paid ? price : 0,
        amountDue: spec.paid ? 0 : price,
        periodStart,
        periodEnd,
        issuedAt: periodStart,
        dueAt: periodEnd, // already in the past for these historical periods
        paidAt: spec.paid ? periodEnd : null,
        lineItems: { create: [{ description, quantity: 1, unitAmount: price, amount: price }] },
      },
    });
    created++;
  }

  const total = await prisma.invoice.count();
  console.log(`  SA-4D:    Invoice=${total} (+${created})`);
}
