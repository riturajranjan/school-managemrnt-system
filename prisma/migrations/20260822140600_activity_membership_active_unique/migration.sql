-- One active membership per student per activity per academic session.
-- Prisma cannot express `@@unique(...) WHERE ...`, so this partial unique
-- index is hand-written (mirrors the Hostel/Health dual-guard pattern).
CREATE UNIQUE INDEX "activity_student_memberships_active_uq"
  ON "activity_student_memberships" ("activityId", "studentId", "academicSessionId")
  WHERE "status" = 'ACTIVE';
