"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Copy, Eye, EyeOff, Plus } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldHint, Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useReportCardTemplates } from "@/lib/hooks/use-exams";
import { CURRENT_SESSION } from "@/lib/data/seed/reference";
import { createReportCardTemplate, duplicateTemplate, setTemplateSections, updateReportCardTemplate } from "@/lib/services/report-card-service";
import { reportCardSectionLabels, reportCardThemeLabels, type ReportCardSectionKey, type ReportCardTemplate, type ReportCardTheme } from "@/lib/types/report-cards";

const themeOptions = Object.keys(reportCardThemeLabels) as ReportCardTheme[];

function blankTemplate(): Omit<ReportCardTemplate, "id" | "createdAt" | "updatedAt"> {
  return {
    name: "",
    theme: "modern-minimal",
    pageSize: "a4",
    orientation: "portrait",
    sections: (Object.keys(reportCardSectionLabels) as ReportCardSectionKey[]).map((key, i) => ({ key, visible: !["co-curricular", "skills", "qr-verification"].includes(key), order: i + 1 })),
    showLogo: true,
    showPhoto: true,
    showQrVerification: false,
    signatureLabels: ["Class Teacher", "Principal"],
    assignedClassIds: [],
    session: CURRENT_SESSION,
    status: "draft",
  };
}

export default function ReportCardTemplatesPage() {
  const templates = useReportCardTemplates();
  const classes = useManagedClasses();
  const { can } = usePermissions();
  const canManage = can("reportCards.manageTemplates");

  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [edit, setEdit] = useState<ReportCardTemplate | null>(null);

  function openEdit(template: ReportCardTemplate) {
    setEdit(template);
  }

  function moveSection(index: number, direction: -1 | 1) {
    if (!edit) return;
    const sections = [...edit.sections].sort((a, b) => a.order - b.order);
    const target = index + direction;
    if (target < 0 || target >= sections.length) return;
    [sections[index], sections[target]] = [sections[target], sections[index]];
    const reordered = sections.map((s, i) => ({ ...s, order: i + 1 }));
    setEdit({ ...edit, sections: reordered });
    setTemplateSections(edit.id, reordered);
  }

  function toggleSection(key: ReportCardSectionKey) {
    if (!edit) return;
    const sections = edit.sections.map((s) => (s.key === key ? { ...s, visible: !s.visible } : s));
    setEdit({ ...edit, sections });
    setTemplateSections(edit.id, sections);
  }

  const columns: ColumnDef<ReportCardTemplate>[] = [
    { id: "name", header: "Template", alwaysVisible: true, sortValue: (t) => t.name, cell: (t) => <span className="text-sm font-medium text-foreground">{t.name}</span> },
    { id: "theme", header: "Theme", cell: (t) => <Badge tone="info">{reportCardThemeLabels[t.theme]}</Badge> },
    { id: "classes", header: "Assigned classes", cell: (t) => <span className="text-sm text-foreground">{t.assignedClassIds.length === 0 ? "All classes" : `${t.assignedClassIds.length} class(es)`}</span> },
    { id: "status", header: "Status", align: "right", cell: (t) => <Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Report card templates</h1>
          <p className="text-xs text-muted-foreground">Structured layouts — show/hide and reorder sections, no free-form drag-and-drop</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => { setNewName(""); setCreateOpen(true); }}>
            <Plus className="size-3.5" />
            New template
          </Button>
        )}
      </div>

      <DataTable
        columns={columns}
        rows={templates}
        getRowId={(t) => t.id}
        caption="Report card templates"
        onRowClick={canManage ? openEdit : undefined}
        rowActions={
          canManage
            ? [{ key: "duplicate", label: "Duplicate", icon: <Copy className="size-3.5" />, onSelect: (t) => duplicateTemplate(t.id) }]
            : undefined
        }
        renderMobileCard={(t) => (
          <button
            type="button"
            onClick={() => canManage && openEdit(t)}
            className="surface-3d flex w-full flex-col gap-1 rounded-lg border border-border bg-surface p-sm text-left outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.99]"
          >
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{t.name}</p>
              <Badge tone={t.status === "active" ? "success" : "neutral"}>{t.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{reportCardThemeLabels[t.theme]}</p>
          </button>
        )}
        emptyTitle="No templates yet"
      />

      <DetailDrawer open={createOpen} onOpenChange={setCreateOpen} title="New report card template" description="Starts from a sensible default layout">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!newName.trim()) return;
            const template = createReportCardTemplate({ ...blankTemplate(), name: newName.trim() });
            setCreateOpen(false);
            openEdit(template);
          }}
          className="flex flex-col gap-sm"
        >
          <div>
            <Label htmlFor="template-name">Template name</Label>
            <Input id="template-name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Senior Secondary Report Card" />
          </div>
          <Button type="submit" disabled={!newName.trim()}>
            Create &amp; configure
          </Button>
        </form>
      </DetailDrawer>

      <DetailDrawer open={edit !== null} onOpenChange={(open) => !open && setEdit(null)} title={edit?.name ?? ""} description="Layout, sections and print settings">
        {edit && (
          <div className="flex flex-col gap-md">
            <div>
              <Label>Theme</Label>
              <Select value={edit.theme} onValueChange={(v) => { updateReportCardTemplate(edit.id, { theme: v as ReportCardTheme }); setEdit({ ...edit, theme: v as ReportCardTheme }); }}>
                <SelectTrigger aria-label="Theme">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {themeOptions.map((t) => (
                    <SelectItem key={t} value={t}>
                      {reportCardThemeLabels[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-sm">
              <div>
                <Label>Page size</Label>
                <Select value={edit.pageSize} onValueChange={(v) => { updateReportCardTemplate(edit.id, { pageSize: v as "a4" | "letter" }); setEdit({ ...edit, pageSize: v as "a4" | "letter" }); }}>
                  <SelectTrigger aria-label="Page size">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a4">A4</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Orientation</Label>
                <Select value={edit.orientation} onValueChange={(v) => { updateReportCardTemplate(edit.id, { orientation: v as "portrait" | "landscape" }); setEdit({ ...edit, orientation: v as "portrait" | "landscape" }); }}>
                  <SelectTrigger aria-label="Orientation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="portrait">Portrait</SelectItem>
                    <SelectItem value="landscape">Landscape</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Sections (reorder, show/hide)</Label>
              <ul className="flex flex-col gap-1">
                {[...edit.sections].sort((a, b) => a.order - b.order).map((section, i) => (
                  <li key={section.key} className="flex items-center gap-xs rounded-md border border-border px-sm py-1.5">
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveSection(i, -1)} disabled={i === 0} className="text-muted-foreground disabled:opacity-30">
                        <ArrowUp className="size-3" />
                      </button>
                      <button type="button" onClick={() => moveSection(i, 1)} disabled={i === edit.sections.length - 1} className="text-muted-foreground disabled:opacity-30">
                        <ArrowDown className="size-3" />
                      </button>
                    </div>
                    <span className={`flex-1 text-sm ${section.visible ? "text-foreground" : "text-muted-foreground line-through"}`}>{reportCardSectionLabels[section.key]}</span>
                    <button type="button" onClick={() => toggleSection(section.key)} className="text-muted-foreground hover:text-foreground" aria-label={`${section.visible ? "Hide" : "Show"} ${reportCardSectionLabels[section.key]}`}>
                      {section.visible ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <Label htmlFor="footer-note">Footer note</Label>
              <Textarea id="footer-note" rows={2} defaultValue={edit.footerNote ?? ""} onBlur={(e) => updateReportCardTemplate(edit.id, { footerNote: e.target.value })} />
            </div>

            <div>
              <Label>Applicable classes</Label>
              <FieldHint>Leave all unchecked to apply to every class.</FieldHint>
              <div className="mt-xs grid max-h-40 grid-cols-2 gap-1 overflow-y-auto rounded-md border border-border p-sm sm:grid-cols-3">
                {classes.map((c) => (
                  <label key={c.id} className="flex min-h-9 items-center gap-1.5 text-sm text-foreground">
                    <Checkbox
                      checked={edit.assignedClassIds.includes(c.id)}
                      onCheckedChange={(checked) => {
                        const next = checked ? [...edit.assignedClassIds, c.id] : edit.assignedClassIds.filter((id) => id !== c.id);
                        updateReportCardTemplate(edit.id, { assignedClassIds: next });
                        setEdit({ ...edit, assignedClassIds: next });
                      }}
                    />
                    {c.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between rounded-md border border-border p-sm">
              <p className="text-sm font-medium text-foreground">Active</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const nextStatus = edit.status === "active" ? "draft" : "active";
                  updateReportCardTemplate(edit.id, { status: nextStatus });
                  setEdit({ ...edit, status: nextStatus });
                }}
              >
                {edit.status === "active" ? "Deactivate" : "Activate"}
              </Button>
            </div>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}
