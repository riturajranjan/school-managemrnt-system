-- Partial unique indexes (Prisma cannot express these). At most one ACTIVE
-- crew assignment per route; at most one ACTIVE transport assignment per
-- student per academic session; at most one ACTIVE transport assignment per
-- staff member. All three are the real concurrency guarantee against a race
-- creating two simultaneously-active assignments.
CREATE UNIQUE INDEX "transport_route_assignments_active_uq" ON "transport_route_assignments"("routeId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "student_transport_assignments_active_uq" ON "student_transport_assignments"("studentId", "academicSessionId") WHERE "status" = 'ACTIVE';
CREATE UNIQUE INDEX "staff_transport_assignments_active_uq" ON "staff_transport_assignments"("staffId") WHERE "status" = 'ACTIVE';
