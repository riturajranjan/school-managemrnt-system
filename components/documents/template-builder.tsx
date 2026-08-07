"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, Eye, Info, LayoutList, Plus, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DocumentSheet, type DocumentSheetData } from "./document-sheet";
import { IdCard } from "./id-card";
import { validateTemplate } from "@/lib/services/documents-service";
import {
  documentKindLabels, paperSizeLabels, sectionTypeLabels,
  type DocumentTemplate, type TemplateSection, type TemplateSectionType,
} from "@/lib/types/documents";
import { cn } from "@/lib/utils";

const ALL_SECTIONS: TemplateSectionType[] = ["logo", "school-name", "address", "contact", "photo", "name", "admission-number", "employee-id", "class", "section", "dob", "guardian", "blood-group", "validity", "qr", "signature", "seal", "document-number", "custom-text", "footer", "body", "subject", "recipient"];

const VARIABLES = [
  { key: "student_name", label: "Student name" }, { key: "admission_number", label: "Admission number" },
  { key: "class", label: "Class" }, { key: "section", label: "Section" }, { key: "academic_session", label: "Academic session" },
  { key: "father_name", label: "Father's name" }, { key: "guardian_name", label: "Guardian name" }, { key: "issue_date", label: "Issue date" },
  { key: "employee_name", label: "Employee name" }, { key: "employee_id", label: "Employee ID" }, { key: "designation", label: "Designation" },
  { key: "event_name", label: "Event name" }, { key: "certificate_number", label: "Certificate number" }, { key: "position", label: "Position" },
];

const SAMPLE_ID = {
  id: "sample", cardNumber: "ID/STU/2026/001", kind: "student" as const, holderName: "Aarav Sharma", subtitle: "Class 5 · A",
  photoColor: "#18b0c8", style: "premium-teal" as const, issueDate: "2026-08-01", expiryDate: "2027-03-31", status: "issued" as const,
  verificationToken: "NVX-SAMPLE01", extra: { admissionNumber: "ADM-2026-001", guardian: "Mr. Sharma", guardianPhone: "+91 •••• ••1234", bloodGroup: "O+" },
};

/** Structured (not free-canvas) template builder. LEFT = available sections,
 * CENTER = live preview, RIGHT = properties of the selected section. Operates on
 * local state — frontend-only, no persistence. */
export function TemplateBuilder({ initial, onSave }: { initial: DocumentTemplate; onSave?: (t: DocumentTemplate) => void }) {
  const [template, setTemplate] = useState<DocumentTemplate>(initial);
  const [selectedId, setSelectedId] = useState<string | null>(initial.sections[0]?.id ?? null);
  const [view, setView] = useState<"preview" | "structure">("preview");
  const [saved, setSaved] = useState(false);

  const issues = useMemo(() => validateTemplate(template), [template]);
  const selected = template.sections.find((s) => s.id === selectedId) ?? null;
  const usedTypes = new Set(template.sections.map((s) => s.type));

  const update = (patch: Partial<DocumentTemplate>) => { setTemplate((t) => ({ ...t, ...patch })); setSaved(false); };
  const updateSection = (id: string, patch: Partial<TemplateSection>) => { setTemplate((t) => ({ ...t, sections: t.sections.map((s) => (s.id === id ? { ...s, ...patch } : s)) })); setSaved(false); };
  const addSection = (type: TemplateSectionType) => {
    const id = `sec-${type}-${new Date().getTime()}`;
    setTemplate((t) => ({ ...t, sections: [...t.sections, { id, type, label: sectionTypeLabels[type], show: true, align: "left", fontSize: "sm", fontWeight: "normal", order: t.sections.length }] }));
    setSelectedId(id); setSaved(false);
  };
  const move = (id: string, dir: -1 | 1) => {
    setTemplate((t) => {
      const arr = [...t.sections].sort((a, b) => a.order - b.order);
      const i = arr.findIndex((s) => s.id === id);
      const j = i + dir;
      if (j < 0 || j >= arr.length) return t;
      [arr[i].order, arr[j].order] = [arr[j].order, arr[i].order];
      return { ...t, sections: arr };
    });
    setSaved(false);
  };

  const previewData: DocumentSheetData = {
    type: template.docType, kind: template.kind, paperSize: template.paperSize, number: "SAMPLE/2026/001", accent: template.accent,
    recipientName: "Aarav Sharma", recipientSubtitle: "Class 5 · A",
    fields: { session: "2026-2027", purpose: "Bank account opening", class: "Class 5 · A", employeeId: "EMP-001", designation: "Teacher", eventName: "Annual Sports Meet", position: "1st Place", conduct: "Good", attendance: "95%" },
    signatoryName: "Dr. Meera Krishnan", token: "NVX-SAMPLE01", showSeal: template.sections.some((s) => s.type === "seal" && s.show),
  };

  const sortedSections = [...template.sections].sort((a, b) => a.order - b.order);

  return (
    <div className="grid grid-cols-1 gap-md lg:grid-cols-[220px_minmax(0,1fr)_240px]">
      {/* LEFT — available sections */}
      <div className="flex flex-col gap-sm">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="mb-sm flex items-center gap-1 text-xs font-semibold text-foreground"><LayoutList className="size-3.5" /> Sections in template</p>
          <div className="flex flex-col gap-1">
            {sortedSections.map((s) => (
              <button key={s.id} type="button" onClick={() => setSelectedId(s.id)} className={cn("flex items-center justify-between gap-1 rounded-md border px-2 py-1.5 text-left text-xs transition", selectedId === s.id ? "border-primary bg-primary/5" : "border-border hover:border-primary/40", !s.show && "opacity-50")}>
                <span className="truncate text-foreground">{sectionTypeLabels[s.type]}</span>
                {!s.show && <Badge tone="neutral">hidden</Badge>}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="mb-sm flex items-center gap-1 text-xs font-semibold text-foreground"><Plus className="size-3.5" /> Add section</p>
          <div className="flex flex-wrap gap-1">
            {ALL_SECTIONS.filter((t) => !usedTypes.has(t)).map((t) => (
              <button key={t} type="button" onClick={() => addSection(t)} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[11px] text-muted-foreground transition hover:text-foreground">+ {sectionTypeLabels[t]}</button>
            ))}
          </div>
        </div>
      </div>

      {/* CENTER — live preview / structure */}
      <div className="flex flex-col gap-sm">
        <div className="flex items-center justify-between">
          <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5">
            <button type="button" onClick={() => setView("preview")} className={cn("flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", view === "preview" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><Eye className="size-3.5" /> Preview</button>
            <button type="button" onClick={() => setView("structure")} className={cn("flex items-center gap-1 rounded px-2.5 py-1 text-xs font-medium", view === "structure" ? "bg-primary text-primary-foreground" : "text-muted-foreground")}><LayoutList className="size-3.5" /> Structure</button>
          </div>
          <Button size="sm" onClick={() => { onSave?.(template); setSaved(true); }} disabled={issues.some((i) => i.level === "error")}><Save className="size-3.5" /> {saved ? "Saved (mock)" : "Save"}</Button>
        </div>

        {issues.length > 0 && (
          <div className="flex flex-col gap-1 rounded-md border border-warning/30 bg-warning/8 p-sm">
            {issues.map((iss, i) => (
              <p key={i} className={cn("flex items-center gap-1 text-xs", iss.level === "error" ? "text-error" : "text-warning")}><AlertTriangle className="size-3.5 shrink-0" /> {iss.message}</p>
            ))}
          </div>
        )}

        <div className="flex justify-center rounded-lg border border-border bg-surface-secondary/40 p-md">
          {view === "preview" ? (
            template.kind === "id-card" ? <IdCard card={{ ...SAMPLE_ID, style: template.style ?? "premium-teal" }} /> : <DocumentSheet data={previewData} />
          ) : (
            <div className="w-full max-w-md space-y-1">
              {sortedSections.filter((s) => s.show).map((s) => (
                <div key={s.id} className={cn("rounded border border-dashed border-border px-2 py-1 text-xs", s.align === "center" && "text-center", s.align === "right" && "text-right")} style={{ color: s.color }}>
                  <span className={cn(s.fontWeight === "bold" && "font-bold", s.fontWeight === "semibold" && "font-semibold", s.fontWeight === "medium" && "font-medium")}>{sectionTypeLabels[s.type]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* RIGHT — properties */}
      <div className="flex flex-col gap-sm">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="mb-sm text-xs font-semibold text-foreground">Template</p>
          <div className="flex flex-col gap-sm">
            <div><Label htmlFor="tpl-name">Name</Label><Input id="tpl-name" value={template.name} onChange={(e) => update({ name: e.target.value })} /></div>
            <div><Label>Paper size</Label>
              <Select value={template.paperSize} onValueChange={(v) => update({ paperSize: v as DocumentTemplate["paperSize"] })}>
                <SelectTrigger aria-label="Paper size"><SelectValue /></SelectTrigger>
                <SelectContent>{Object.entries(paperSizeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="tpl-accent">Accent colour</Label><input id="tpl-accent" type="color" value={template.accent} onChange={(e) => update({ accent: e.target.value })} className="h-8 w-full rounded border border-border bg-surface" /></div>
            <p className="text-[11px] text-muted-foreground">{documentKindLabels[template.kind]} template</p>
          </div>
        </div>

        {selected ? (
          <div className="rounded-lg border border-border bg-surface p-sm">
            <p className="mb-sm text-xs font-semibold text-foreground">Section: {sectionTypeLabels[selected.type]}</p>
            <div className="flex flex-col gap-sm text-xs">
              <label className="flex items-center justify-between"><span className="text-muted-foreground">Visible</span><input type="checkbox" checked={selected.show} onChange={(e) => updateSection(selected.id, { show: e.target.checked })} /></label>
              <div><Label>Alignment</Label>
                <Select value={selected.align} onValueChange={(v) => updateSection(selected.id, { align: v as TemplateSection["align"] })}>
                  <SelectTrigger aria-label="Alignment"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="left">Left</SelectItem><SelectItem value="center">Center</SelectItem><SelectItem value="right">Right</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>Font size</Label>
                <Select value={selected.fontSize} onValueChange={(v) => updateSection(selected.id, { fontSize: v as TemplateSection["fontSize"] })}>
                  <SelectTrigger aria-label="Font size"><SelectValue /></SelectTrigger>
                  <SelectContent>{["xs", "sm", "base", "lg", "xl"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label>Font weight</Label>
                <Select value={selected.fontWeight} onValueChange={(v) => updateSection(selected.id, { fontWeight: v as TemplateSection["fontWeight"] })}>
                  <SelectTrigger aria-label="Font weight"><SelectValue /></SelectTrigger>
                  <SelectContent>{["normal", "medium", "semibold", "bold"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label htmlFor="sec-color">Text colour</Label><input id="sec-color" type="color" value={selected.color ?? "#111111"} onChange={(e) => updateSection(selected.id, { color: e.target.value })} className="h-7 w-full rounded border border-border" /></div>
              {selected.type === "custom-text" && <div><Label htmlFor="sec-custom">Custom text</Label><Input id="sec-custom" value={selected.customText ?? ""} onChange={(e) => updateSection(selected.id, { customText: e.target.value })} /></div>}
              <div className="flex gap-1"><Button size="sm" variant="outline" onClick={() => move(selected.id, -1)}><ArrowUp className="size-3.5" /></Button><Button size="sm" variant="outline" onClick={() => move(selected.id, 1)}><ArrowDown className="size-3.5" /></Button></div>
            </div>
          </div>
        ) : <p className="rounded-lg border border-dashed border-border p-sm text-xs text-muted-foreground">Select a section to edit its properties.</p>}

        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-foreground"><Info className="size-3.5" /> Variables</p>
          <div className="flex flex-wrap gap-1">{VARIABLES.map((v) => <span key={v.key} title={`{{${v.key}}}`} className="rounded-pill bg-surface-secondary px-2 py-0.5 text-[10px] text-muted-foreground">{v.label}</span>)}</div>
        </div>
      </div>
    </div>
  );
}
