-- Partial unique index (Prisma cannot express a WHERE clause in @@unique).
-- At most one ISSUED loan per copy at a time — the real concurrency
-- guarantee against two simultaneous issue attempts on the same copy,
-- belt-and-suspenders alongside the conditional copy-status update in
-- lib/server/library/loans.ts.
CREATE UNIQUE INDEX "library_loans_active_copy_uq" ON "library_loans"("copyId") WHERE "status" = 'ISSUED';
