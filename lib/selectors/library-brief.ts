import type { Db } from "@/lib/data/store";
import { addMoney, formatMoney, zeroMoney, type Money } from "@/lib/finance/money";
import { computeAvailability } from "./book-availability";
import { fineOutstanding } from "@/lib/services/library-fine-service";

export type LibrarySummary = {
  totalTitles: number;
  totalCopies: number;
  availableCopies: number;
  issuedCopies: number;
  overdueLoans: number;
  reservedTitles: number;
  activeMembers: number;
  finesOutstanding: Money;
  lostOrDamaged: number;
  digitalResources: number;
  dueToday: number;
  pendingStockVerification: number;
};

const TODAY = () => new Date().toISOString().slice(0, 10);

export function librarySummary(db: Db): LibrarySummary {
  const today = TODAY();
  const copies = db.bookCopies.filter((c) => c.loanStatus !== "withdrawn");
  const availability = computeAvailability(copies);
  const activeLoans = db.libraryLoans.filter((l) => l.status === "active" || l.status === "overdue" || l.status === "renewed");
  const finesOutstanding = db.libraryFines
    .filter((f) => f.status === "pending" || f.status === "generated" || f.status === "partially-paid")
    .reduce((sum, f) => addMoney(sum, fineOutstanding(f)), zeroMoney("INR"));

  return {
    totalTitles: db.books.filter((b) => !b.archived).length,
    totalCopies: copies.length,
    availableCopies: availability.available,
    issuedCopies: availability.issued,
    overdueLoans: activeLoans.filter((l) => l.status === "overdue" || l.dueDate < today).length,
    reservedTitles: new Set(db.libraryReservations.filter((r) => r.status === "waiting" || r.status === "ready").map((r) => r.bookId)).size,
    activeMembers: db.libraryMembers.filter((m) => m.status === "active").length,
    finesOutstanding,
    lostOrDamaged: copies.filter((c) => c.condition === "lost" || c.condition === "damaged").length,
    digitalResources: db.digitalResources.length,
    dueToday: activeLoans.filter((l) => l.dueDate === today).length,
    pendingStockVerification: db.shelves.filter((s) => s.stocktakeStatus === "due" || s.stocktakeStatus === "overdue" || s.stocktakeStatus === "never").length,
  };
}

export type LibraryException = {
  id: string;
  label: string;
  description: string;
  severity: "high" | "medium" | "low";
  href: string;
};

/** The "what should the librarian handle today?" feed — real, ranked issues
 * pulled from live state (overdue, ready reservations, expiring reservations,
 * unpaid fines, lost copies, shelves needing verification). */
export function libraryExceptions(db: Db): LibraryException[] {
  const today = TODAY();
  const out: LibraryException[] = [];

  const overdue = db.libraryLoans.filter((l) => (l.status === "active" || l.status === "overdue" || l.status === "renewed") && l.dueDate < today);
  if (overdue.length > 0) out.push({ id: "overdue", label: `${overdue.length} overdue loan(s)`, description: "Books past their due date need follow-up.", severity: overdue.length > 10 ? "high" : "medium", href: "/library/loans" });

  const ready = db.libraryReservations.filter((r) => r.status === "ready");
  if (ready.length > 0) out.push({ id: "ready", label: `${ready.length} reservation(s) ready`, description: "Members are waiting to collect held titles.", severity: "medium", href: "/library/reservations" });

  const expiring = ready.filter((r) => r.expiresAt && r.expiresAt <= today);
  if (expiring.length > 0) out.push({ id: "expiring", label: `${expiring.length} hold(s) expiring`, description: "Pickup deadline reached — release to the next member.", severity: "high", href: "/library/reservations" });

  const unpaid = db.libraryFines.filter((f) => f.status === "pending" || f.status === "partially-paid");
  if (unpaid.length > 0) out.push({ id: "fines", label: `${unpaid.length} unpaid fine(s)`, description: "Outstanding library charges to collect or add to accounts.", severity: "low", href: "/library/fines" });

  const lost = db.bookCopies.filter((c) => c.condition === "lost");
  if (lost.length > 0) out.push({ id: "lost", label: `${lost.length} lost copy(ies)`, description: "Missing copies need replacement or write-off.", severity: "medium", href: "/library/copies" });

  const shelvesDue = db.shelves.filter((s) => s.stocktakeStatus === "overdue");
  if (shelvesDue.length > 0) out.push({ id: "stock", label: `${shelvesDue.length} shelf verification(s) overdue`, description: "Run a shelf stocktake to keep the catalogue accurate.", severity: "low", href: "/library/shelves" });

  const severityRank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}

export function formatFineTotal(m: Money): string {
  return formatMoney(m, { compact: true });
}
