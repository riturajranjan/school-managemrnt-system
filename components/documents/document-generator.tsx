"use client";

import { useMemo, useState } from "react";
import { Check, CircleCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentSheet, type DocumentSheetData } from "./document-sheet";
import { IdCard } from "./id-card";
import { useSisStore } from "@/lib/hooks/use-store";
import { generateDocument, previewNumber } from "@/lib/services/documents-service";
import { findClass, findSection } from "@/lib/data/seed/reference";
import { documentTypeLabels, type DocumentRecipient, type DocumentTemplate, type IdCardRecord } from "@/lib/types/documents";
import { cn } from "@/lib/utils";

const STEPS = ["Template", "Recipient", "Fields", "Preview", "Generate"];

/** Central generation workflow. `templateFilter` restricts the selectable
 * templates (e.g. only certificates). Frontend simulation only. */
export function DocumentGenerator({ templateFilter, initialTemplateId, generatedBy }: { templateFilter?: (t: DocumentTemplate) => boolean; initialTemplateId?: string; generatedBy: string }) {
  const db = useSisStore();
  const templates = useMemo(() => db.documentTemplates.filter((t) => t.status !== "archived" && (templateFilter ? templateFilter(t) : true)), [db.documentTemplates, templateFilter]);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? templates[0]?.id ?? "");
  const [recipientKind, setRecipientKind] = useState<"student" | "staff">("student");
  const [recipientId, setRecipientId] = useState("");
  const [purpose, setPurpose] = useState("Bank account opening");
  const [addToQueue, setAddToQueue] = useState(true);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const template = templates.find((t) => t.id === templateId);
  const isIdCard = template?.kind === "id-card";
  const isStaffDoc = template ? ["staff-id", "experience-letter", "appointment-letter", "salary-certificate", "employment-certificate", "relieving-letter", "offer-letter"].includes(template.docType) : false;

  const students = useMemo(() => db.students.filter((s) => s.status === "active").slice(0, 60), [db.students]);
  const staff = useMemo(() => db.employees.slice(0, 60), [db.employees]);

  const recipient: DocumentRecipient | null = useMemo(() => {
    if (isStaffDoc || recipientKind === "staff") {
      const e = staff.find((x) => x.id === recipientId);
      return e ? { id: `rec-${e.id}`, type: "staff", refId: e.id, name: `${e.firstName} ${e.lastName}`, subtitle: e.employeeCode } : null;
    }
    const s = students.find((x) => x.id === recipientId);
    if (!s) return null;
    const c = findClass(s.classId); const sec = findSection(s.sectionId)?.section;
    return { id: `rec-${s.id}`, type: "student", refId: s.id, name: `${s.profile.firstName} ${s.profile.lastName}`, subtitle: c ? `${c.name}${sec ? ` · ${sec.name}` : ""}` : "" };
  }, [recipientId, recipientKind, isStaffDoc, students, staff]);

  const stepDone = [Boolean(template), Boolean(recipient), Boolean(recipient), Boolean(template && recipient), Boolean(result?.ok)];

  const previewData: DocumentSheetData | null = template && recipient ? {
    type: template.docType, kind: template.kind, paperSize: template.paperSize, number: template.numberingRuleId ? previewNumber(template.numberingRuleId) : undefined, accent: template.accent,
    recipientName: recipient.name, recipientSubtitle: recipient.subtitle,
    fields: { session: "2026-2027", purpose, class: recipient.subtitle ?? "", employeeId: recipient.subtitle ?? "", designation: "Teacher", eventName: "School Event" },
    signatoryName: template.signatoryId ? db.signatoryProfiles.find((s) => s.id === template.signatoryId)?.name : undefined, token: "NVX-PREVIEW",
    showSeal: template.sections.some((s) => s.type === "seal" && s.show),
  } : null;

  const previewCardKind: IdCardRecord["kind"] = recipientKind === "staff" || isStaffDoc ? "staff" : "student";
  const previewCard: IdCardRecord | null = isIdCard && recipient ? {
    id: "preview", cardNumber: template?.numberingRuleId ? previewNumber(template.numberingRuleId) : "ID/PREVIEW", kind: previewCardKind,
    holderName: recipient.name, subtitle: recipient.subtitle ?? "", photoColor: "#18b0c8", style: template?.style ?? "premium-teal", issueDate: undefined, expiryDate: "2027-03-31", status: "draft",
    verificationToken: "NVX-PREVIEW", extra: { admissionNumber: recipient.subtitle ?? "" },
  } : null;

  const onGenerate = () => {
    if (!template || !recipient) return;
    const r = generateDocument({ type: template.docType, template, recipient, fields: { studentName: recipient.name, class: recipient.subtitle ?? "", session: "2026-2027", purpose }, generatedBy, addToQueue });
    if (r.ok) setResult({ ok: true, msg: `Generated ${documentTypeLabels[template.docType]} for ${recipient.name}.${addToQueue ? " Added to print queue." : ""}` });
    else setResult({ ok: false, msg: r.error });
  };

  return (
    <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-md">
        {/* Progress */}
        <ol className="flex items-center gap-1 overflow-x-auto text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span className={cn("flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-1 font-medium", stepDone[i] ? "bg-success/15 text-success" : "bg-surface-secondary text-muted-foreground")}>{stepDone[i] ? <Check className="size-3" /> : <span className="text-[10px]">{i + 1}</span>} {s}</span>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </li>
          ))}
        </ol>

        <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div><Label>1 · Template</Label>
            <Select value={templateId} onValueChange={(v) => { setTemplateId(v); setResult(null); }}>
              <SelectTrigger aria-label="Template"><SelectValue placeholder="Select a template" /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name} · {documentTypeLabels[t.docType]}</SelectItem>)}</SelectContent>
            </Select>
          </div>

          <div><Label>2 · Recipient {isStaffDoc ? "(staff)" : ""}</Label>
            {!isStaffDoc && (
              <div className="mb-1 flex gap-1">
                <button type="button" onClick={() => { setRecipientKind("student"); setRecipientId(""); }} className={cn("rounded-pill px-2.5 py-0.5 text-xs", recipientKind === "student" ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground")}>Student</button>
                <button type="button" onClick={() => { setRecipientKind("staff"); setRecipientId(""); }} className={cn("rounded-pill px-2.5 py-0.5 text-xs", recipientKind === "staff" ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground")}>Staff</button>
              </div>
            )}
            <Select value={recipientId} onValueChange={(v) => { setRecipientId(v); setResult(null); }}>
              <SelectTrigger aria-label="Recipient"><SelectValue placeholder="Select a recipient" /></SelectTrigger>
              <SelectContent>
                {(isStaffDoc || recipientKind === "staff" ? staff.map((e) => ({ id: e.id, name: `${e.firstName} ${e.lastName}`, sub: e.employeeCode })) : students.map((s) => ({ id: s.id, name: `${s.profile.firstName} ${s.profile.lastName}`, sub: s.admissionNumber }))).map((r) => <SelectItem key={r.id} value={r.id}>{r.name} · {r.sub}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {!isIdCard && <div><Label htmlFor="gen-purpose">3 · Purpose / note</Label><Input id="gen-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>}

          <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={addToQueue} onChange={(e) => setAddToQueue(e.target.checked)} /> Add to print queue after generating</label>

          {result && <p className={cn("flex items-center gap-1 rounded-md border p-sm text-xs", result.ok ? "border-success/30 bg-success/8 text-success" : "border-error/30 bg-error/8 text-error")}>{result.ok ? <CircleCheck className="size-3.5" /> : null}{result.msg}</p>}

          <Button size="sm" onClick={onGenerate} disabled={!template || !recipient}><Sparkles className="size-3.5" /> Generate (simulation)</Button>
        </div>
      </div>

      {/* Live preview */}
      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">Preview</p>{template && <Badge tone="neutral">{documentTypeLabels[template.docType]}</Badge>}</div>
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
          {!template || !recipient ? <p className="text-sm text-muted-foreground">Select a template and recipient to preview.</p> : isIdCard && previewCard ? <IdCard card={previewCard} /> : previewData ? <DocumentSheet data={previewData} /> : null}
        </div>
      </div>
    </div>
  );
}
