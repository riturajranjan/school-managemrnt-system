// Super Admin Phase SA-4A seed — a small, realistic plan catalog. Structured
// data only (Decimal price + currency + numeric limits) — no formatted strings,
// no fake revenue metrics. Idempotent: keyed by the unique plan code.
import type { PrismaClient } from "../lib/generated/prisma/client";
import type { BillingInterval, PlanStatus } from "../lib/generated/prisma/enums";

type PlanSeed = {
  code: string;
  name: string;
  description: string;
  price: number;
  billingInterval: BillingInterval;
  trialDays: number;
  status: PlanStatus;
  sortOrder: number;
  maxStudents: number | null;
  maxStaff: number | null;
  maxBranches: number | null;
  storageGb: number | null;
  supportLevel: string;
  whiteLabel: boolean;
  features: string[];
};

const PLANS: PlanSeed[] = [
  {
    code: "STARTER", name: "Starter", description: "For a single small school getting started.",
    price: 4999, billingInterval: "MONTHLY", trialDays: 14, status: "ACTIVE", sortOrder: 1,
    maxStudents: 300, maxStaff: 30, maxBranches: 1, storageGb: 10, supportLevel: "standard", whiteLabel: false,
    features: ["students", "admissions", "attendance"],
  },
  {
    code: "PROFESSIONAL", name: "Professional", description: "Growing schools that need fees and communication.",
    price: 9999, billingInterval: "MONTHLY", trialDays: 14, status: "ACTIVE", sortOrder: 2,
    maxStudents: 1000, maxStaff: 80, maxBranches: 3, storageGb: 50, supportLevel: "priority", whiteLabel: false,
    features: ["students", "admissions", "attendance", "fees", "communication"],
  },
  {
    code: "BUSINESS", name: "Business", description: "Multi-branch institutions with transport and library.",
    price: 19999, billingInterval: "MONTHLY", trialDays: 14, status: "ACTIVE", sortOrder: 3,
    maxStudents: 3000, maxStaff: 200, maxBranches: 6, storageGb: 200, supportLevel: "priority", whiteLabel: false,
    features: ["students", "admissions", "attendance", "fees", "communication", "transport", "library", "documents"],
  },
  {
    code: "ENTERPRISE", name: "Enterprise", description: "Unlimited scale with HR and white-label.",
    price: 49999, billingInterval: "MONTHLY", trialDays: 30, status: "ACTIVE", sortOrder: 4,
    maxStudents: null, maxStaff: null, maxBranches: null, storageGb: null, supportLevel: "dedicated", whiteLabel: true,
    features: ["students", "admissions", "attendance", "fees", "communication", "transport", "library", "documents", "hr"],
  },
];

export async function seedPlans(prisma: PrismaClient) {
  let created = 0;
  for (const p of PLANS) {
    const existing = await prisma.plan.findUnique({ where: { code: p.code }, select: { id: true } });
    if (existing) continue;
    await prisma.plan.create({
      data: {
        code: p.code, name: p.name, description: p.description, currency: "INR",
        price: p.price, billingInterval: p.billingInterval, trialDays: p.trialDays,
        isPublic: true, sortOrder: p.sortOrder, status: p.status,
        maxStudents: p.maxStudents, maxStaff: p.maxStaff, maxBranches: p.maxBranches, storageGb: p.storageGb,
        supportLevel: p.supportLevel, whiteLabel: p.whiteLabel,
        features: { create: p.features.map((key) => ({ key })) },
      },
    });
    created++;
  }
  const total = await prisma.plan.count();
  console.log(`  SA-4A:    Plan=${total} (+${created})`);
}
