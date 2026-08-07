import type { Db } from "@/lib/data/store";
import type { FlowStage } from "@/lib/types/documents";

const TODAY = () => new Date().toISOString().slice(0, 10);

export type DocumentsSummary = {
  generatedToday: number;
  pendingPrint: number;
  certificatesIssued: number;
  idCardsIssued: number;
  templates: number;
  batchJobs: number;
  verificationChecks: number;
  failedJobs: number;
  expiringIds: number;
  draftDocuments: number;
};

export function documentsSummary(db: Db): DocumentsSummary {
  const today = TODAY();
  const soon = new Date(); soon.setDate(soon.getDate() + 30);
  const soonStr = soon.toISOString().slice(0, 10);
  return {
    generatedToday: db.generatedDocuments.filter((d) => d.generatedAt.slice(0, 10) === today).length,
    pendingPrint: db.printQueue.filter((p) => p.status === "queued" || p.status === "preparing" || p.status === "ready").length,
    certificatesIssued: db.generatedDocuments.filter((d) => (d.kind === "student-certificate" || d.kind === "staff-certificate" || d.kind === "activity-certificate") && (d.status === "issued" || d.status === "generated" || d.status === "printed")).length,
    idCardsIssued: db.idCards.filter((c) => c.status === "issued").length,
    templates: db.documentTemplates.filter((t) => t.status !== "archived").length,
    batchJobs: db.documentBatches.length,
    verificationChecks: db.verificationRecords.length,
    failedJobs: db.documentBatches.filter((b) => b.status === "failed").length + db.printQueue.filter((p) => p.status === "failed").length,
    expiringIds: db.idCards.filter((c) => c.status === "issued" && c.expiryDate <= soonStr).length,
    draftDocuments: db.generatedDocuments.filter((d) => d.status === "draft").length + db.documentTemplates.filter((t) => t.status === "draft").length,
  };
}

// Document Flow — aggregate counts at each pipeline stage (dashboard visual).
export function documentFlowCounts(db: Db): Record<FlowStage, number> {
  return {
    source: db.students.filter((s) => s.status === "active").length + db.employees.length,
    template: db.documentTemplates.filter((t) => t.status === "active").length,
    preview: db.generatedDocuments.filter((d) => d.status === "draft").length + db.documentBatches.filter((b) => b.status === "draft" || b.status === "ready").length,
    generate: db.generatedDocuments.filter((d) => d.status === "generated").length,
    verify: db.verificationRecords.length,
    print: db.printQueue.length,
    archive: db.generatedDocuments.filter((d) => d.status === "issued" || d.status === "archived" || d.status === "printed").length,
  };
}

export type DocTypeCount = { type: string; label: string; count: number };

export function documentsByType(db: Db, labels: Record<string, string>): DocTypeCount[] {
  const counts = new Map<string, number>();
  db.generatedDocuments.forEach((d) => counts.set(d.type, (counts.get(d.type) ?? 0) + 1));
  return [...counts.entries()].map(([type, count]) => ({ type, label: labels[type] ?? type, count })).sort((a, b) => b.count - a.count);
}
