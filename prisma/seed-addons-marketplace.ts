// Super Admin Phase SA-4M seed — real Add-on + Marketplace catalogs. Structured
// data only (Decimal price + currency for add-ons; provider metadata for apps).
// Idempotent: keyed by the unique code. No school assignments/installations are
// seeded (those are created via the real APIs).
import type { PrismaClient } from "../lib/generated/prisma/client";
import type { BillingInterval } from "../lib/generated/prisma/enums";

type AddOnSeed = { code: string; name: string; description: string; category: string; priceAmount: number | null; billingInterval: BillingInterval | null };

const ADDONS: AddOnSeed[] = [
  { code: "EXTRA_BRANCH", name: "Additional branch", description: "Add another campus/branch beyond the plan limit.", category: "Capacity", priceAmount: 3000, billingInterval: "MONTHLY" },
  { code: "STUDENTS_500", name: "Student capacity +500", description: "Increase the student seat limit by 500.", category: "Capacity", priceAmount: 2500, billingInterval: "MONTHLY" },
  { code: "STORAGE_50GB", name: "Storage +50GB", description: "Extra document & media storage.", category: "Capacity", priceAmount: 1000, billingInterval: "MONTHLY" },
  { code: "SMS_PACK", name: "SMS package", description: "Transactional SMS credits.", category: "Communication", priceAmount: 1500, billingInterval: "MONTHLY" },
  { code: "ADVANCED_ANALYTICS", name: "Advanced analytics", description: "Cross-module analytics dashboards.", category: "Analytics", priceAmount: 4000, billingInterval: "MONTHLY" },
  { code: "WHITE_LABEL", name: "White-label", description: "Remove platform branding.", category: "Branding", priceAmount: 5000, billingInterval: "MONTHLY" },
  { code: "PREMIUM_SUPPORT", name: "Premium support", description: "Priority response & a success manager.", category: "Support", priceAmount: 6000, billingInterval: "MONTHLY" },
];

type AppSeed = { code: string; name: string; description: string; category: string; providerName: string; documentationUrl?: string };

const APPS: AppSeed[] = [
  { code: "RAZORPAY", name: "Razorpay", description: "Collect fees via UPI, cards and netbanking.", category: "payments", providerName: "Razorpay" },
  { code: "STRIPE", name: "Stripe", description: "International card payments.", category: "payments", providerName: "Stripe" },
  { code: "WHATSAPP_BUSINESS", name: "WhatsApp Business", description: "Template messaging to parents.", category: "communication", providerName: "Meta" },
  { code: "MSG91_SMS", name: "SMS Gateway", description: "Transactional SMS delivery.", category: "communication", providerName: "MSG91" },
  { code: "OBJECT_STORAGE", name: "Object Storage", description: "S3-compatible document & media storage.", category: "storage", providerName: "S3-compatible" },
  { code: "FLEET_GPS", name: "Fleet GPS", description: "Live bus tracking feed.", category: "gps", providerName: "TrackPro" },
  { code: "ZOOM_CLASSES", name: "Video Classes", description: "Online class scheduling.", category: "learning", providerName: "Zoom" },
];

export async function seedAddonsMarketplace(prisma: PrismaClient) {
  let addonsCreated = 0;
  for (const a of ADDONS) {
    const existing = await prisma.addOn.findUnique({ where: { code: a.code }, select: { id: true } });
    if (existing) continue;
    await prisma.addOn.create({
      data: { code: a.code, name: a.name, description: a.description, category: a.category, status: "ACTIVE", priceAmount: a.priceAmount, currency: "INR", billingInterval: a.billingInterval },
    });
    addonsCreated++;
  }

  let appsCreated = 0;
  for (const p of APPS) {
    const existing = await prisma.marketplaceApp.findUnique({ where: { code: p.code }, select: { id: true } });
    if (existing) continue;
    await prisma.marketplaceApp.create({
      data: { code: p.code, name: p.name, description: p.description, category: p.category, providerName: p.providerName, documentationUrl: p.documentationUrl ?? null, status: "ACTIVE" },
    });
    appsCreated++;
  }

  const [addonTotal, appTotal] = await Promise.all([prisma.addOn.count(), prisma.marketplaceApp.count()]);
  console.log(`  SA-4M:    AddOn=${addonTotal} (+${addonsCreated}) MarketplaceApp=${appTotal} (+${appsCreated})`);
}
