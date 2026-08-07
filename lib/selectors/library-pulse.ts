import type { Db } from "@/lib/data/store";
import { computeAvailability } from "./book-availability";

export type LibraryPulseFactor = { key: string; label: string; score: number; displayValue: string; tone: "success" | "warning" | "error" };
export type LibraryPulse = { score: number; factors: LibraryPulseFactor[] };

function toneFor(score: number): "success" | "warning" | "error" {
  if (score >= 80) return "success";
  if (score >= 60) return "warning";
  return "error";
}

const TODAY = () => new Date().toISOString().slice(0, 10);

/** A real, computed health score (0-100) for the library — every factor is
 * derived from live store data (availability, overdue rate, reservation
 * fulfilment, stock accuracy, member activity, digital engagement, fine
 * resolution, lost-book rate), never a decorative placeholder. Unweighted
 * average, same shape as the Academic/Transport Pulse. */
export function computeLibraryPulse(db: Db): LibraryPulse {
  const today = TODAY();
  const copies = db.bookCopies.filter((c) => c.loanStatus !== "withdrawn");
  const availability = computeAvailability(copies);

  // Availability — share of circulating copies currently on the shelf.
  const availabilityScore = copies.length > 0 ? Math.round((availability.available / copies.length) * 100) : 100;

  // Overdue rate — inverse of the share of active loans that are overdue.
  const activeLoans = db.libraryLoans.filter((l) => l.status === "active" || l.status === "overdue" || l.status === "renewed");
  const overdueLoans = db.libraryLoans.filter((l) => l.status === "overdue" || ((l.status === "active" || l.status === "renewed") && l.dueDate < today));
  const overdueScore = activeLoans.length > 0 ? Math.round((1 - overdueLoans.length / activeLoans.length) * 100) : 100;

  // Reservation fulfilment — share of reservations that reached ready/collected/fulfilled.
  const reservations = db.libraryReservations;
  const fulfilled = reservations.filter((r) => r.status === "ready" || r.status === "collected" || r.status === "fulfilled").length;
  const relevant = reservations.filter((r) => r.status !== "cancelled").length;
  const reservationScore = relevant > 0 ? Math.round((fulfilled / relevant) * 100) : 100;

  // Stock accuracy — share of copies checked within the last 120 days.
  const checkedRecently = copies.filter((c) => c.lastStockCheck && daysSince(c.lastStockCheck) <= 120).length;
  const stockScore = copies.length > 0 ? Math.round((checkedRecently / copies.length) * 100) : 100;

  // Member activity — share of active members who have borrowed at least once.
  const activeMembers = db.libraryMembers.filter((m) => m.status === "active");
  const borrowers = new Set(db.libraryLoans.map((l) => l.memberId));
  const activityScore = activeMembers.length > 0 ? Math.round((activeMembers.filter((m) => borrowers.has(m.id)).length / activeMembers.length) * 100) : 0;

  // Digital engagement — normalised total views across published resources.
  const totalViews = db.digitalResources.reduce((sum, r) => sum + r.viewCount, 0);
  const digitalScore = db.digitalResources.length > 0 ? Math.min(100, Math.round((totalViews / (db.digitalResources.length * 40)) * 100)) : 0;

  // Fine resolution — share of fines that are paid/waived/cancelled (settled).
  const fines = db.libraryFines;
  const settled = fines.filter((f) => f.status === "paid" || f.status === "waived" || f.status === "cancelled" || f.status === "refunded").length;
  const fineScore = fines.length > 0 ? Math.round((settled / fines.length) * 100) : 100;

  // Lost-book rate — inverse of the share of copies marked lost/damaged.
  const badCopies = copies.filter((c) => c.condition === "lost" || c.condition === "damaged").length;
  const lostScore = copies.length > 0 ? Math.round((1 - badCopies / copies.length) * 100) : 100;

  const factors: LibraryPulseFactor[] = [
    { key: "availability", label: "Availability", score: availabilityScore, displayValue: `${availability.available}/${copies.length} on shelf`, tone: toneFor(availabilityScore) },
    { key: "overdue", label: "Overdue rate", score: overdueScore, displayValue: `${overdueLoans.length} overdue`, tone: toneFor(overdueScore) },
    { key: "reservations", label: "Reservation fulfilment", score: reservationScore, displayValue: `${fulfilled}/${relevant} fulfilled`, tone: toneFor(reservationScore) },
    { key: "stock", label: "Stock accuracy", score: stockScore, displayValue: `${checkedRecently}/${copies.length} verified`, tone: toneFor(stockScore) },
    { key: "activity", label: "Member activity", score: activityScore, displayValue: `${activityScore}% active`, tone: toneFor(activityScore) },
    { key: "digital", label: "Digital engagement", score: digitalScore, displayValue: `${totalViews} views`, tone: toneFor(digitalScore) },
    { key: "fines", label: "Fine resolution", score: fineScore, displayValue: `${settled}/${fines.length} settled`, tone: toneFor(fineScore) },
    { key: "lost", label: "Lost-book rate", score: lostScore, displayValue: `${badCopies} lost/damaged`, tone: toneFor(lostScore) },
  ];

  const score = Math.max(0, Math.min(100, Math.round(factors.reduce((sum, f) => sum + f.score, 0) / factors.length)));
  return { score, factors };
}

function daysSince(iso: string): number {
  return Math.round((Date.now() - new Date(iso).getTime()) / 86_400_000);
}
