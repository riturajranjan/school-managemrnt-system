// Visitor identity (Phase 9I) — real, PostgreSQL-backed. A Visitor is the
// person; VisitorVisit (visits.ts) is one visit by that person. Lookup
// strategy: match an existing Visitor by (schoolId, phone, fullName) case-
// insensitive exact — phone alone is too weak a key (a shared household/
// office phone could belong to different people), so both must match to
// reuse a row; otherwise a new Visitor is created. Never mutates an existing
// Visitor's name/organization from a later visit's form values — a visit is
// a snapshot event, not a profile edit.
import { Prisma } from "@/lib/generated/prisma/client";

export async function findOrCreateVisitor(
  tx: Prisma.TransactionClient,
  scope: { tenantId: string; schoolId: string },
  input: { fullName: string; phone: string; organization?: string },
): Promise<string> {
  const existing = await tx.visitor.findFirst({
    where: { schoolId: scope.schoolId, phone: input.phone, fullName: { equals: input.fullName, mode: "insensitive" } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const created = await tx.visitor.create({
    data: { tenantId: scope.tenantId, schoolId: scope.schoolId, fullName: input.fullName, phone: input.phone, organization: input.organization ?? null },
    select: { id: true },
  });
  return created.id;
}
