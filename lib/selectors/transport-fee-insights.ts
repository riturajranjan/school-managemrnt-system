import type { Db } from "@/lib/data/store";
import { sumMoney, zeroMoney } from "@/lib/finance/money";
import { resolveFeeRuleForRoute } from "@/lib/services/transport-fee-service";

export function transportFeeInsights(db: Db, session: string) {
  const charges = db.transportFeeCharges.filter((c) => c.session === session);
  const billable = charges.filter((c) => c.status !== "cancelled");

  const totalExpected = billable.length > 0 ? sumMoney(billable.map((c) => c.billedAmount), "INR") : zeroMoney("INR");
  const totalCollected = billable.length > 0 ? sumMoney(billable.map((c) => c.paidAmount), "INR") : zeroMoney("INR");
  const totalPending = { minorUnits: Math.max(0, totalExpected.minorUnits - totalCollected.minorUnits), currency: "INR" as const };

  const overdue = charges.filter((c) => (c.status === "pending" || c.status === "partial") && c.dueDate < new Date().toISOString().slice(0, 10));

  const byRoute = db.transportRoutes.map((route) => {
    const routeCharges = billable.filter((c) => {
      const assignment = db.studentTransportAssignments.find((a) => a.id === c.assignmentId) ?? db.staffTransportAssignments.find((a) => a.id === c.assignmentId);
      return assignment?.routeId === route.id;
    });
    return {
      routeId: route.id,
      expected: routeCharges.length > 0 ? sumMoney(routeCharges.map((c) => c.billedAmount), "INR") : zeroMoney("INR"),
      collected: routeCharges.length > 0 ? sumMoney(routeCharges.map((c) => c.paidAmount), "INR") : zeroMoney("INR"),
      chargeCount: routeCharges.length,
    };
  });

  const unbilledStudentAssignments = db.studentTransportAssignments.filter((a) => a.status === "active" && a.session === session && !resolveFeeRuleForRoute(db, a.routeId, session));

  return { charges, totalExpected, totalCollected, totalPending, overdue, byRoute, unbilledStudentAssignments };
}
