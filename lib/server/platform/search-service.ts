// Platform (Super Admin) global search service (Phase SA-4H). Searches REAL
// PostgreSQL entities whose backends exist — Schools, Subscriptions, Invoices,
// Payments, Plans. Results are PERMISSION-AWARE: a category is only queried when
// the caller holds its view permission (the server filters, never the UI). Only
// small per-category slices are read (no full-table loads, no N+1).
import { prisma } from "@/lib/db/prisma";
import { billingIntervalToUi, invoiceStatusToUi, paymentMethodToUi, planStatusToUi, schoolStatusToUi, subscriptionStatusToUi } from "@/lib/server/api/enums";

// Minimum characters before hitting the DB; shorter queries return nothing.
export const MIN_QUERY_LENGTH = 2;
const PER_CATEGORY_LIMIT = 5;

export type SearchResultType = "school" | "subscription" | "invoice" | "payment" | "plan";

export type SearchResult = {
  type: SearchResultType;
  id: string;
  title: string;
  subtitle: string;
  href: string;
  status: string | null;
};

// category → the platform view permission that authorizes it.
const CATEGORY_PERMISSION: Record<SearchResultType, string> = {
  school: "platform.schools.view",
  subscription: "platform.subscriptions.view",
  invoice: "platform.invoices.view",
  payment: "platform.payments.view",
  plan: "platform.plans.view",
};

export const ALL_SEARCH_TYPES: SearchResultType[] = ["school", "subscription", "invoice", "payment", "plan"];

/** The categories the caller may search — the ONLY authority is real permissions. */
export function authorizedTypes(permissions: Set<string>, requested?: SearchResultType[]): SearchResultType[] {
  const base = requested && requested.length ? requested : ALL_SEARCH_TYPES;
  return base.filter((t) => permissions.has(CATEGORY_PERMISSION[t]));
}

// --- Per-category queries (each takes a bounded slice) -----------------------

async function searchSchools(q: string): Promise<SearchResult[]> {
  const rows = await prisma.school.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }, { tenant: { name: { contains: q, mode: "insensitive" } } }] },
    take: PER_CATEGORY_LIMIT,
    orderBy: { name: "asc" },
    select: { id: true, name: true, code: true, status: true, tenant: { select: { name: true } } },
  });
  return rows.map((s) => ({ type: "school", id: s.id, title: s.name, subtitle: `${s.code} · ${s.tenant.name}`, href: `/super-admin/schools/${s.id}`, status: schoolStatusToUi[s.status] }));
}

async function searchSubscriptions(q: string): Promise<SearchResult[]> {
  const rows = await prisma.subscription.findMany({
    where: { OR: [{ school: { name: { contains: q, mode: "insensitive" } } }, { tenant: { name: { contains: q, mode: "insensitive" } } }, { plan: { name: { contains: q, mode: "insensitive" } } }] },
    take: PER_CATEGORY_LIMIT,
    orderBy: { createdAt: "desc" },
    select: { id: true, status: true, billingInterval: true, school: { select: { name: true } }, plan: { select: { name: true } } },
  });
  return rows.map((s) => ({ type: "subscription", id: s.id, title: s.school.name, subtitle: `${s.plan.name} · ${billingIntervalToUi[s.billingInterval]}`, href: `/super-admin/subscriptions/${s.id}`, status: subscriptionStatusToUi[s.status] }));
}

async function searchInvoices(q: string): Promise<SearchResult[]> {
  const rows = await prisma.invoice.findMany({
    where: { OR: [{ invoiceNumber: { contains: q, mode: "insensitive" } }, { school: { name: { contains: q, mode: "insensitive" } } }, { tenant: { name: { contains: q, mode: "insensitive" } } }] },
    take: PER_CATEGORY_LIMIT,
    orderBy: { createdAt: "desc" },
    select: { id: true, invoiceNumber: true, status: true, school: { select: { name: true } } },
  });
  // The invoices UI uses a list + drawer (no per-invoice route) — link to the list.
  return rows.map((i) => ({ type: "invoice", id: i.id, title: i.invoiceNumber, subtitle: i.school.name, href: "/super-admin/invoices", status: invoiceStatusToUi[i.status] }));
}

async function searchPayments(q: string): Promise<SearchResult[]> {
  const rows = await prisma.payment.findMany({
    where: { OR: [{ paymentNumber: { contains: q, mode: "insensitive" } }, { reference: { contains: q, mode: "insensitive" } }, { invoice: { invoiceNumber: { contains: q, mode: "insensitive" } } }, { school: { name: { contains: q, mode: "insensitive" } } }] },
    take: PER_CATEGORY_LIMIT,
    orderBy: { receivedAt: "desc" },
    select: { id: true, paymentNumber: true, status: true, method: true, school: { select: { name: true } } },
  });
  return rows.map((p) => ({ type: "payment", id: p.id, title: p.paymentNumber, subtitle: `${p.school.name} · ${paymentMethodToUi[p.method]}`, href: "/super-admin/payments", status: p.status.toLowerCase() }));
}

async function searchPlans(q: string): Promise<SearchResult[]> {
  const rows = await prisma.plan.findMany({
    where: { OR: [{ name: { contains: q, mode: "insensitive" } }, { code: { contains: q, mode: "insensitive" } }] },
    take: PER_CATEGORY_LIMIT,
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true, code: true, status: true },
  });
  return rows.map((p) => ({ type: "plan", id: p.id, title: p.name, subtitle: `Plan · ${p.code}`, href: "/super-admin/plans", status: planStatusToUi[p.status] }));
}

const RUNNERS: Record<SearchResultType, (q: string) => Promise<SearchResult[]>> = {
  school: searchSchools,
  subscription: searchSubscriptions,
  invoice: searchInvoices,
  payment: searchPayments,
  plan: searchPlans,
};

export type GlobalSearchResult = { query: string; results: SearchResult[] };

/**
 * Run the search across the caller's authorized categories. `types` is already
 * permission-filtered by the route via `authorizedTypes`.
 */
export async function globalSearch(rawQuery: string, types: SearchResultType[]): Promise<GlobalSearchResult> {
  const query = rawQuery.trim();
  if (query.length < MIN_QUERY_LENGTH || types.length === 0) return { query, results: [] };

  const batches = await Promise.all(types.map((t) => RUNNERS[t](query)));
  // Preserve a stable category order (matches ALL_SEARCH_TYPES).
  const ordered = ALL_SEARCH_TYPES.filter((t) => types.includes(t));
  const byType = new Map(ordered.map((t, i) => [t, batches[types.indexOf(t)] ?? []] as const));
  const results = ordered.flatMap((t) => byType.get(t) ?? []);
  return { query, results };
}
