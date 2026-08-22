-- Partial unique index (Prisma cannot express a WHERE clause in @@unique).
-- At most one ACTIVE (returnedAt IS NULL) assignment per asset — the real
-- concurrency guarantee against two simultaneous assign attempts on the same
-- asset, belt-and-suspenders alongside the conditional Asset-status update
-- in lib/server/assets/assignments.ts. Mirrors library_loans_active_copy_uq
-- from Phase 9N.
CREATE UNIQUE INDEX "asset_assignments_active_asset_uq" ON "asset_assignments"("assetId") WHERE "returnedAt" IS NULL;
