// Super Admin Phase SA-4B seed — a small, realistic set of subscriptions on the
// real demo school(s) + real plans. Structured terms only (snapshot price +
// currency + interval); no fake MRR/renewal strings. Idempotent: skips a school
// that already has any subscription. Respects the one-current invariant (a school
// gets at most one CURRENT subscription; a CANCELLED row is historical).
import type { PrismaClient } from "../lib/generated/prisma/client";

function addMonthsUtc(date: Date, months: number): Date {
  const d = new Date(date.getTime());
  const day = d.getUTCDate();
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).getUTCDate();
  d.setUTCDate(Math.min(day, lastDay));
  return d;
}
function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

export async function seedSubscriptions(prisma: PrismaClient, ctx: { tenantId: string; schoolId: string }) {
  const [starter, professional] = await Promise.all([
    prisma.plan.findUnique({ where: { code: "STARTER" }, select: { id: true, price: true, currency: true, billingInterval: true } }),
    prisma.plan.findUnique({ where: { code: "PROFESSIONAL" }, select: { id: true, price: true, currency: true, billingInterval: true } }),
  ]);
  if (!starter || !professional) {
    console.log("  SA-4B:    Subscription seed skipped (plans not found)");
    return;
  }

  const now = new Date();
  let created = 0;

  // --- Primary demo school (NPS-001): one CANCELLED history + one ACTIVE current.
  const primaryHasSub = await prisma.subscription.findFirst({ where: { schoolId: ctx.schoolId }, select: { id: true } });
  if (!primaryHasSub) {
    const cancelStart = addMonthsUtc(now, -4);
    await prisma.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        schoolId: ctx.schoolId,
        planId: starter.id,
        status: "CANCELLED",
        startDate: cancelStart,
        currentPeriodStart: cancelStart,
        currentPeriodEnd: addMonthsUtc(cancelStart, 1),
        cancelledAt: addMonthsUtc(now, -3),
        endedAt: addMonthsUtc(now, -3),
        priceAmount: starter.price,
        currency: starter.currency,
        billingInterval: starter.billingInterval,
      },
    });
    const activeStart = addMonthsUtc(now, -1);
    await prisma.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        schoolId: ctx.schoolId,
        planId: professional.id,
        status: "ACTIVE",
        startDate: activeStart,
        currentPeriodStart: activeStart,
        currentPeriodEnd: addMonthsUtc(activeStart, 1),
        priceAmount: professional.price,
        currency: professional.currency,
        billingInterval: professional.billingInterval,
      },
    });
    created += 2;
  }

  // --- A second demo school (NIS-001) to showcase a TRIALING subscription.
  const school2 = await prisma.school.upsert({
    where: { tenantId_code: { tenantId: ctx.tenantId, code: "NIS-001" } },
    update: {},
    create: {
      tenantId: ctx.tenantId,
      name: "Novyra International School",
      shortName: "NIS",
      code: "NIS-001",
      schoolType: "K-12",
      board: "IB",
      email: "office@nis.novyra-demo.example",
      timezone: "Asia/Kolkata",
      locale: "en-IN",
      currency: "INR",
      status: "ACTIVE",
    },
  });
  const school2HasSub = await prisma.subscription.findFirst({ where: { schoolId: school2.id }, select: { id: true } });
  if (!school2HasSub) {
    const trialEnd = addDaysUtc(now, 14);
    await prisma.subscription.create({
      data: {
        tenantId: ctx.tenantId,
        schoolId: school2.id,
        planId: starter.id,
        status: "TRIALING",
        startDate: now,
        trialStart: now,
        trialEnd,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        priceAmount: starter.price,
        currency: starter.currency,
        billingInterval: starter.billingInterval,
      },
    });
    created += 1;
  }

  const total = await prisma.subscription.count();
  console.log(`  SA-4B:    Subscription=${total} (+${created})`);
}
