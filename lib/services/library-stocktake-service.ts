import { getSnapshot, setState } from "@/lib/data/store";
import type { Db } from "@/lib/data/store";
import type { LibraryStocktake, LibraryStocktakeItem, StocktakeScope } from "@/lib/types/library";
import { generateId } from "@/lib/utils";
import { logResourceAudit } from "./resource-audit-service";

type Actor = { name: string; role: string };
type Result = { ok: true } | { ok: false; error: string };

/** The copies a stocktake of `scope`/`target` is expected to cover. */
export function expectedCopies(db: Db, libraryId: string, scope: StocktakeScope, targetId?: string) {
  const inLibrary = db.bookCopies.filter((c) => c.libraryId === libraryId && c.loanStatus !== "withdrawn");
  if (scope === "shelf") return inLibrary.filter((c) => c.shelfId === targetId);
  if (scope === "category") {
    const bookIds = new Set(db.books.filter((b) => b.categoryId === targetId).map((b) => b.id));
    return inLibrary.filter((c) => bookIds.has(c.bookId));
  }
  if (scope === "random") {
    return inLibrary.filter((_, i) => i % 5 === 0);
  }
  return inLibrary;
}

export function createStocktake(input: { libraryId: string; scope: StocktakeScope; scopeTargetId?: string }, actor: Actor): Result & { stocktake?: LibraryStocktake } {
  const db = getSnapshot();
  const expected = expectedCopies(db, input.libraryId, input.scope, input.scopeTargetId);
  const now = new Date().toISOString();
  const stocktake: LibraryStocktake = {
    id: generateId("stk"),
    libraryId: input.libraryId,
    reference: `STK-${now.slice(0, 10)}-${db.libraryStocktakes.length + 1}`,
    scope: input.scope,
    scopeTargetId: input.scopeTargetId,
    status: "in-progress",
    startedBy: actor.name,
    startedAt: now,
    expectedCount: expected.length,
    scannedCount: 0,
    missingCount: 0,
    unexpectedCount: 0,
    misplacedCount: 0,
    createdAt: now,
    updatedAt: now,
  };
  const items: LibraryStocktakeItem[] = expected.map((c) => ({ id: generateId("stkitem"), stocktakeId: stocktake.id, copyId: c.id, expectedShelfId: c.shelfId, result: "expected", resolved: false }));
  setState((current) => ({ ...current, libraryStocktakes: [stocktake, ...current.libraryStocktakes], libraryStocktakeItems: [...current.libraryStocktakeItems, ...items] }));
  logResourceAudit({ domain: "library", subjectId: stocktake.id, action: "stocktake-created", actorName: actor.name, actorRole: actor.role, summary: `${input.scope} stocktake ${stocktake.reference} started (${expected.length} expected).` });
  return { ok: true, stocktake };
}

/** Records a scanned copy against an in-progress stocktake, classifying it as
 * found / unexpected / misplaced and rolling up the header counts. */
export function scanStocktakeItem(stocktakeId: string, copyId: string, foundShelfId: string | undefined): Result {
  const db = getSnapshot();
  const stocktake = db.libraryStocktakes.find((s) => s.id === stocktakeId);
  if (!stocktake) return { ok: false, error: "Stocktake not found." };
  if (stocktake.status !== "in-progress") return { ok: false, error: "Stocktake is not in progress." };

  const now = new Date().toISOString();
  const existing = db.libraryStocktakeItems.find((i) => i.stocktakeId === stocktakeId && i.copyId === copyId);
  const misplaced = existing?.expectedShelfId !== undefined && foundShelfId !== undefined && existing.expectedShelfId !== foundShelfId;

  setState((current) => {
    let items = current.libraryStocktakeItems;
    if (existing) {
      items = items.map((i) => (i.id === existing.id ? { ...i, result: misplaced ? "misplaced" : "scanned", foundShelfId, scannedAt: now } : i));
    } else {
      items = [...items, { id: generateId("stkitem"), stocktakeId, copyId, foundShelfId, result: "unexpected", resolved: false, scannedAt: now }];
    }
    const mine = items.filter((i) => i.stocktakeId === stocktakeId);
    const scannedCount = mine.filter((i) => i.result === "scanned" || i.result === "misplaced").length;
    const misplacedCount = mine.filter((i) => i.result === "misplaced").length;
    const unexpectedCount = mine.filter((i) => i.result === "unexpected").length;
    const missingCount = mine.filter((i) => i.result === "expected").length;
    return {
      ...current,
      libraryStocktakeItems: items,
      libraryStocktakes: current.libraryStocktakes.map((s) => (s.id === stocktakeId ? { ...s, scannedCount, misplacedCount, unexpectedCount, missingCount, updatedAt: now } : s)),
    };
  });
  return { ok: true };
}

/** Closes a stocktake. Once completed it is immutable — the header + items are
 * a permanent audit record. Missing copies are flagged (never auto-deleted). */
export function completeStocktake(stocktakeId: string, actor: Actor): Result {
  const db = getSnapshot();
  const stocktake = db.libraryStocktakes.find((s) => s.id === stocktakeId);
  if (!stocktake) return { ok: false, error: "Stocktake not found." };
  if (stocktake.status === "completed") return { ok: false, error: "Stocktake is already completed." };

  const now = new Date().toISOString();
  const items = db.libraryStocktakeItems.filter((i) => i.stocktakeId === stocktakeId);
  const missing = items.filter((i) => i.result === "expected").map((i) => i.copyId);
  setState((current) => ({
    ...current,
    libraryStocktakes: current.libraryStocktakes.map((s) => (s.id === stocktakeId ? { ...s, status: "completed", completedAt: now, missingCount: missing.length, updatedAt: now } : s)),
    libraryStocktakeItems: current.libraryStocktakeItems.map((i) => (i.stocktakeId === stocktakeId && i.result === "expected" ? { ...i, result: "missing" } : i)),
    // Flag missing copies' last stock check so shelves show a verification gap; copies are preserved.
    shelves: current.shelves.map((sh) => (sh.id === stocktake.scopeTargetId ? { ...sh, lastStockCheck: now, stocktakeStatus: "verified" } : sh)),
  }));
  logResourceAudit({ domain: "library", subjectId: stocktakeId, action: "stocktake-completed", actorName: actor.name, actorRole: actor.role, summary: `Stocktake ${stocktake.reference} completed — ${missing.length} missing, ${stocktake.misplacedCount} misplaced.` });
  return { ok: true };
}

export function cancelStocktake(stocktakeId: string): Result {
  const db = getSnapshot();
  const stocktake = db.libraryStocktakes.find((s) => s.id === stocktakeId);
  if (!stocktake) return { ok: false, error: "Stocktake not found." };
  if (stocktake.status === "completed") return { ok: false, error: "A completed stocktake cannot be cancelled." };
  const now = new Date().toISOString();
  setState((current) => ({ ...current, libraryStocktakes: current.libraryStocktakes.map((s) => (s.id === stocktakeId ? { ...s, status: "cancelled", updatedAt: now } : s)) }));
  return { ok: true };
}
