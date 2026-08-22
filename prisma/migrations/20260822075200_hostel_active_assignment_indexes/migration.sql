-- Partial unique indexes (Prisma cannot express a WHERE clause in @@unique).
-- At most one ACTIVE occupant per bed, and at most one ACTIVE hostel
-- assignment per student per academic session — the real concurrency
-- guarantee against two simultaneous allocations, belt-and-suspenders
-- alongside the conditional updates in lib/server/hostel/assignments.ts.
-- Mirrors library_loans_active_copy_uq (Phase 9N) / asset_assignments_active_asset_uq (Phase 9O).
CREATE UNIQUE INDEX "student_hostel_assignments_active_bed_uq" ON "student_hostel_assignments"("bedId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "student_hostel_assignments_active_student_session_uq" ON "student_hostel_assignments"("studentId", "academicSessionId") WHERE "status" = 'ACTIVE';

-- At most one ACTIVE staff assignment per (hostel, staff, role) — e.g. a
-- given staff member can't be assigned WARDEN of the same hostel twice.
CREATE UNIQUE INDEX "hostel_staff_assignments_active_uq" ON "hostel_staff_assignments"("hostelId", "staffId", "role") WHERE "status" = 'ACTIVE';
