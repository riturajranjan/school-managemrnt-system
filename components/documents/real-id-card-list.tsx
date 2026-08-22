"use client";

// Real Student/Staff ID cards (Phase 9V) — mirrors the original IdCardManager's
// layout (search, card grid, front preview drawer), but backed by the real
// GeneratedDocument(docType=student-id|staff-id) domain instead of the mock
// db.idCards. A fresh component (not a rewrite) because the original
// IdCardManager stays in use, unmodified, by the still-mock Library/Transport/
// Hostel ID card kinds. Real ID cards have only two states (generated / void)
// — no invented not-generated/printed/issued/expired/replaced pipeline; the
// "back" side (emergency contact, warden, etc.) is omitted rather than filled
// with placeholder data with no real backing.
import { useState } from "react";
import { Ban, Eye, Search, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Textarea } from "@/components/ui/input";
import { IdCard } from "./id-card";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { generateDocumentRequest, useDocumentTemplates, useGeneratedDocuments, voidDocumentRequest } from "@/lib/hooks/api/use-document-studio-api";
import type { DocTypeDto } from "@/lib/api/contracts";

export function RealIdCardList({ subjectType }: { subjectType: "student" | "staff" }) {
  const { hasServerPermission } = usePermissions();
  const canGenerate = hasServerPermission("documents.generate");
  const canVoid = hasServerPermission("documents.void");
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const docType: DocTypeDto = subjectType === "student" ? "student-id" : "staff-id";
  const { data: templates } = useDocumentTemplates({ docType, status: "active" });
  const template = templates[0];
  const { data: students } = useStudentList(subjectType === "student" ? { status: ["active"], pageSize: 300 } : { status: [], pageSize: 0 });
  const { data: staffList } = useStaffList(subjectType === "staff" ? { status: "active", pageSize: 300 } : { status: "active", pageSize: 0 });
  const { data: cards, reload } = useGeneratedDocuments({ docType });

  const people = subjectType === "student"
    ? students.map((s) => ({ id: s.id, name: s.fullName, sub: s.admissionNumber }))
    : staffList.map((s) => ({ id: s.id, name: s.name, sub: s.employeeCode }));
  const filtered = query.trim() ? people.filter((p) => p.name.toLowerCase().includes(query.trim().toLowerCase())) : people;
  const cardFor = (personId: string) => cards.find((c) => (subjectType === "student" ? c.studentId : c.staffId) === personId && c.status === "generated");
  const doc = cards.find((c) => c.id === openId) ?? null;

  async function onGenerate(personId: string) {
    if (!template) return;
    setBusyId(personId);
    await generateDocumentRequest({ templateId: template.id, studentId: subjectType === "student" ? personId : undefined, staffId: subjectType === "staff" ? personId : undefined });
    setBusyId(null);
    reload();
  }

  async function onVoid() {
    if (!doc || !voidReason.trim()) return;
    await voidDocumentRequest(doc.id, { reason: voidReason.trim() });
    setVoidReason("");
    setOpenId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md">
      {!template && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No active {subjectType} ID card template yet.</p>}
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${subjectType}s…`} aria-label="Search" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((p) => {
          const existing = cardFor(p.id);
          return (
            <div key={p.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{p.name}</p><p className="truncate text-xs text-muted-foreground">{p.sub}</p></div>
                <Badge tone={existing ? "success" : "neutral"}>{existing ? "Generated" : "Not generated"}</Badge>
              </div>
              <div className="flex flex-wrap gap-1">
                {existing && <Button size="sm" variant="outline" onClick={() => { setOpenId(existing.id); setVoidReason(""); }}><Eye className="size-3.5" /> Preview</Button>}
                {canGenerate && template && !existing && <Button size="sm" disabled={busyId === p.id} onClick={() => onGenerate(p.id)}><Sparkles className="size-3.5" /> Generate</Button>}
              </div>
            </div>
          );
        })}
        {filtered.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No {subjectType}s found.</div>}
      </div>

      <DetailDrawer open={Boolean(doc)} onOpenChange={(o) => !o && setOpenId(null)} title={doc ? `${doc.recipientName} — ${subjectType} ID card` : ""} description={doc?.documentNumber}>
        {doc && "cardNumber" in doc.rendered && (
          <div className="flex flex-col gap-md">
            <IdCard card={doc.rendered} />
            <p className="text-center text-xs text-muted-foreground">CR80 preview · exact card aspect ratio · print-styled.</p>
            {canVoid && (
              <div className="flex flex-col gap-xs rounded-md border border-border p-sm">
                <Textarea value={voidReason} onChange={(e) => setVoidReason(e.target.value)} placeholder="Reason for voiding (required)" rows={2} />
                <Button size="sm" variant="ghost" className="w-fit" disabled={!voidReason.trim()} onClick={onVoid}><Ban className="size-3.5" /> Void card</Button>
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
