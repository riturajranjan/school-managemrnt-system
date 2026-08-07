"use client";

import { useMemo, useState } from "react";
import { Eye, FileText, IdCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { DocumentSheet } from "@/components/documents/document-sheet";
import { IdCard as IdCardView } from "@/components/documents/id-card";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { documentStatusLabels, documentStatusTone, documentTypeLabels } from "@/lib/types/documents";
import { formatDate } from "@/lib/utils";

// Document types a student/parent is permitted to see. Excludes internal/staff docs.
const PERMITTED = new Set(["student-id", "library-card", "transport-card", "hostel-card", "bonafide-certificate", "study-certificate", "attendance-certificate", "character-certificate", "participation-certificate", "sports-certificate", "achievement-certificate", "admit-card", "fee-receipt"]);

export default function StudentDocumentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [openId, setOpenId] = useState<string | null>(null);

  const child = db.students[0];
  const docs = useMemo(() => (child ? db.generatedDocuments.filter((d) => d.recipient.refId === child.id && d.status !== "draft" && d.status !== "revoked" && PERMITTED.has(d.type)) : []), [db.generatedDocuments, child]);
  const cards = useMemo(() => (child ? db.idCards.filter((c) => c.holderId === child.id && (c.status === "issued" || c.status === "printed")) : []), [db.idCards, child]);
  const doc = docs.find((d) => d.id === openId) ?? null;
  const template = doc ? db.documentTemplates.find((t) => t.id === doc.templateId) : undefined;

  if (!can("documents.viewOwn") && !can("documents.view")) return <PermissionDenied action="view your documents" role={roleLabels[role]} backHref="/" />;
  if (!child) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No student profile found.</div>;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><FileText className="size-4" /></span><div><h1 className="text-lg font-semibold text-foreground">My documents — {child.profile.firstName}</h1><p className="text-xs text-muted-foreground">Certificates, ID cards and receipts issued to you</p></div></div>

      {cards.length > 0 && (
        <section>
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><IdCard className="size-4" /> ID cards</h2>
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">{cards.map((c) => <IdCardView key={c.id} card={c} />)}</div>
        </section>
      )}

      <section>
        <h2 className="mb-sm text-sm font-semibold text-foreground">Certificates &amp; documents</h2>
        <div className="flex flex-col gap-xs">
          {docs.filter((d) => d.kind !== "id-card").map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <div className="min-w-0"><p className="truncate font-medium text-foreground">{documentTypeLabels[d.type]}</p><p className="truncate text-xs text-muted-foreground">{d.number} · {formatDate(d.generatedAt.slice(0, 10))}</p></div>
              <div className="flex items-center gap-xs"><Badge tone={documentStatusTone[d.status]}>{documentStatusLabels[d.status]}</Badge><Button size="sm" variant="outline" onClick={() => setOpenId(d.id)}><Eye className="size-3.5" /></Button></div>
            </div>
          ))}
          {docs.filter((d) => d.kind !== "id-card").length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No documents issued to you yet.</div>}
        </div>
      </section>

      <DetailDrawer open={Boolean(doc)} onOpenChange={(o) => !o && setOpenId(null)} title={doc ? documentTypeLabels[doc.type] : ""} description={doc?.number}>
        {doc && <DocumentSheet data={{ type: doc.type, kind: doc.kind, paperSize: doc.paperSize, number: doc.number, accent: template?.accent ?? "#18b0c8", recipientName: doc.recipient.name, recipientSubtitle: doc.recipient.subtitle, fields: doc.fields, signatoryName: doc.signatoryName, issuedDate: (doc.issuedDate ?? doc.generatedAt).slice(0, 10), token: doc.verificationToken, showSeal: true }} />}
      </DetailDrawer>
    </div>
  );
}
