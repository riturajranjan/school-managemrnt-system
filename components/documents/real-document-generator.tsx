"use client";

// Real generation workflow (Phase 9V) — mirrors the original DocumentGenerator's
// layout/steps exactly, but resolves merge fields and issues documents through
// the real /api/document-studio/* endpoints. A fresh component (not a rewrite
// of the original DocumentGenerator) because that component is still used
// as-is by the deferred admit-cards/letters mock pages, which must keep
// working unmodified.
import { useEffect, useMemo, useState } from "react";
import { Check, CircleCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentSheet } from "./document-sheet";
import { IdCard } from "./id-card";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useStudentAchievements } from "@/lib/hooks/api/use-activities-api";
import { generateDocumentRequest, previewDocumentRequest, useDocumentTemplates } from "@/lib/hooks/api/use-document-studio-api";
import type { DocTypeDto, DocumentSheetDataDto, IdCardRecordDto } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

const STEPS = ["Template", "Recipient", "Fields", "Preview", "Generate"];
const isIdCardDocType = (t?: DocTypeDto) => t === "student-id" || t === "staff-id";

export function RealDocumentGenerator({ docTypeFilter, initialTemplateId }: { docTypeFilter?: DocTypeDto[]; initialTemplateId?: string }) {
  const { data: allTemplates } = useDocumentTemplates({ status: "active" });
  const templates = useMemo(() => (docTypeFilter ? allTemplates.filter((t) => docTypeFilter.includes(t.docType)) : allTemplates), [allTemplates, docTypeFilter]);
  const [templateId, setTemplateId] = useState(initialTemplateId ?? "");
  const [recipientId, setRecipientId] = useState("");
  const [achievementId, setAchievementId] = useState("");
  const [purpose, setPurpose] = useState("Bank account opening");
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [preview, setPreview] = useState<{ rendered: DocumentSheetDataDto | IdCardRecordDto; unresolved: string[] } | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const effectiveTemplateId = templateId || templates[0]?.id || "";
  const template = templates.find((t) => t.id === effectiveTemplateId);
  const isIdCard = template ? isIdCardDocType(template.docType) : false;
  const isAchievement = template?.docType === "achievement-certificate";

  const { data: students } = useStudentList(template?.subjectType === "student" ? { status: ["active"], pageSize: 300 } : { status: [], pageSize: 0 });
  const { data: staff } = useStaffList(template?.subjectType === "staff" ? { status: "active", pageSize: 300 } : { status: "active", pageSize: 0 });
  const { data: achievements } = useStudentAchievements(isAchievement ? recipientId : undefined);

  function handleTemplateChange(id: string) {
    setTemplateId(id);
    setRecipientId("");
    setAchievementId("");
    setResult(null);
    setPreview(null);
    setPreviewError(null);
  }

  useEffect(() => {
    if (!template || !recipientId || (isAchievement && !achievementId)) return;
    let cancelled = false;
    previewDocumentRequest({
      templateId: template.id,
      studentId: template.subjectType === "student" ? recipientId : undefined,
      staffId: template.subjectType === "staff" ? recipientId : undefined,
      achievementId: isAchievement ? achievementId : undefined,
      purpose: !isIdCard ? purpose : undefined,
    }).then((res) => {
      if (cancelled) return;
      if (res.success) { setPreview(res.data); setPreviewError(null); }
      else { setPreviewError(res.error.message); setPreview(null); }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [template?.id, recipientId, achievementId, purpose]);

  const stepDone = [Boolean(template), Boolean(recipientId), Boolean(!isAchievement || achievementId), Boolean(preview), Boolean(result?.ok)];

  async function onGenerate() {
    if (!template || !recipientId) return;
    const res = await generateDocumentRequest({
      templateId: template.id,
      studentId: template.subjectType === "student" ? recipientId : undefined,
      staffId: template.subjectType === "staff" ? recipientId : undefined,
      achievementId: isAchievement ? achievementId : undefined,
      purpose: !isIdCard ? purpose : undefined,
    });
    if (res.success) setResult({ ok: true, msg: `Generated ${res.data.documentNumber} for ${res.data.recipientName}.` });
    else setResult({ ok: false, msg: res.error.message });
  }

  return (
    <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="flex flex-col gap-md">
        <ol className="flex items-center gap-1 overflow-x-auto text-xs">
          {STEPS.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span className={cn("flex items-center gap-1 whitespace-nowrap rounded-pill px-2 py-1 font-medium", stepDone[i] ? "bg-success/15 text-success" : "bg-surface-secondary text-muted-foreground")}>{stepDone[i] ? <Check className="size-3" /> : <span className="text-[10px]">{i + 1}</span>} {s}</span>
              {i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </li>
          ))}
        </ol>

        <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div>
            <Label>1 · Template</Label>
            <Select value={effectiveTemplateId} onValueChange={handleTemplateChange}>
              <SelectTrigger aria-label="Template"><SelectValue placeholder="Select a template" /></SelectTrigger>
              <SelectContent>{templates.map((t) => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent>
            </Select>
            {templates.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No active templates yet.</p>}
          </div>

          {template && (
            <div>
              <Label>2 · Recipient ({template.subjectType})</Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger aria-label="Recipient"><SelectValue placeholder={`Select a ${template.subjectType}`} /></SelectTrigger>
                <SelectContent>
                  {template.subjectType === "student"
                    ? students.map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName} · {s.admissionNumber}</SelectItem>)
                    : staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name} · {s.employeeCode}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {isAchievement && recipientId && (
            <div>
              <Label>3 · Achievement</Label>
              <Select value={achievementId} onValueChange={setAchievementId}>
                <SelectTrigger aria-label="Achievement"><SelectValue placeholder="Select an achievement" /></SelectTrigger>
                <SelectContent>{achievements.map((a) => <SelectItem key={a.id} value={a.id}>{a.title}</SelectItem>)}</SelectContent>
              </Select>
              {achievements.length === 0 && <p className="mt-1 text-xs text-muted-foreground">No achievements on record for this student.</p>}
            </div>
          )}

          {!isIdCard && template && !isAchievement && <div><Label htmlFor="gen-purpose">3 · Purpose / note</Label><Input id="gen-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} /></div>}

          {previewError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{previewError}</p>}
          {preview && preview.unresolved.length > 0 && <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">Missing data: {preview.unresolved.join(", ")} — generation will fail until resolved.</p>}
          {result && <p className={cn("flex items-center gap-1 rounded-md border p-sm text-xs", result.ok ? "border-success/30 bg-success/8 text-success" : "border-error/30 bg-error/8 text-error")}>{result.ok ? <CircleCheck className="size-3.5" /> : null}{result.msg}</p>}

          <Button size="sm" onClick={onGenerate} disabled={!template || !recipientId || (isAchievement && !achievementId) || (preview?.unresolved.length ?? 0) > 0}><Sparkles className="size-3.5" /> Generate</Button>
        </div>
      </div>

      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between"><p className="text-sm font-semibold text-foreground">Preview</p>{template && <Badge tone="neutral">{template.name}</Badge>}</div>
        <div className="flex min-h-64 items-center justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
          {!template || !recipientId ? <p className="text-sm text-muted-foreground">Select a template and recipient to preview.</p>
            : !preview ? <p className="text-sm text-muted-foreground">Loading preview…</p>
            : "cardNumber" in preview.rendered ? <IdCard card={preview.rendered} />
            : <DocumentSheet data={preview.rendered} />}
        </div>
      </div>
    </div>
  );
}
