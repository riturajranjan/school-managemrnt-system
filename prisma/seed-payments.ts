// Super Admin Phase SA-4E seed — one real payment settling the seeded overdue
// invoice, so /super-admin/payments and the billing "Collected" figure have real
// data. Idempotent: skips if any payment already exists. Uses the same
// payment_number_seq the app uses. Money is Decimal.
import type { PrismaClient } from "../lib/generated/prisma/client";

async function nextPaymentNumber(prisma: PrismaClient, year: number): Promise<string> {
  const rows = await prisma.$queryRaw<{ nextval: bigint }[]>`SELECT nextval('payment_number_seq') AS nextval`;
  return `PAY-${year}-${String(Number(rows[0].nextval)).padStart(6, "0")}`;
}

export async function seedPayments(prisma: PrismaClient) {
  const existing = await prisma.payment.findFirst({ select: { id: true } });
  if (existing) {
    const total = await prisma.payment.count();
    console.log(`  SA-4E:    Payment=${total} (+0)`);
    return;
  }

  // Settle an OPEN invoice with an outstanding balance (partial payment).
  const invoice = await prisma.invoice.findFirst({
    where: { status: "OPEN", amountDue: { gt: 0 } },
    select: { id: true, tenantId: true, schoolId: true, subscriptionId: true, currency: true, amountDue: true, invoiceNumber: true },
    orderBy: { createdAt: "asc" },
  });
  if (!invoice) {
    console.log("  SA-4E:    Payment seed skipped (no open invoice)");
    return;
  }

  const now = new Date();
  // Partial payment = half the amount due (leaves the invoice OPEN).
  const half = invoice.amountDue.dividedBy(2);
  const paymentNumber = await nextPaymentNumber(prisma, now.getUTCFullYear());

  await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: {
        paymentNumber,
        tenantId: invoice.tenantId,
        schoolId: invoice.schoolId,
        invoiceId: invoice.id,
        subscriptionId: invoice.subscriptionId,
        status: "SUCCEEDED",
        method: "BANK_TRANSFER",
        amount: half,
        currency: invoice.currency,
        reference: "SEED-UTR-0001",
        notes: "Seeded partial settlement",
        receivedAt: now,
        recordedByName: "Seed",
      },
    });
    await tx.invoice.update({
      where: { id: invoice.id },
      data: { amountPaid: half, amountDue: invoice.amountDue.minus(half) },
    });
  });

  const total = await prisma.payment.count();
  console.log(`  SA-4E:    Payment=${total} (+1) — partial settle of ${invoice.invoiceNumber}`);
}
