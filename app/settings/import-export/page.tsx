"use client";

import { useState } from "react";
import { AlertTriangle, Download, FileSpreadsheet, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { startExport } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const IMPORT_MODULES = ["Students", "Staff", "Parents", "Fees", "Marks", "Library", "Inventory"];
const EXPORT_MODULES = ["Students", "Staff", "Fees", "Attendance", "Exams", "Library"];
const STEPS = ["Template", "Upload", "Mapping", "Validation", "Review", "Import"];

export default function ImportExportPage() {
  const { role } = usePermissions();
  const admin = useAdmin();
  const [, force] = useState(0);
  const [tab, setTab] = useState<"import" | "export">("import");
  const [importModule, setImportModule] = useState("Students");
  const [exportModule, setExportModule] = useState("Students");
  const [format, setFormat] = useState<"csv" | "xlsx" | "pdf">("xlsx");

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="import or export data" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><FileSpreadsheet className="size-5 text-primary" /> Import / Export</h1><p className="text-xs text-muted-foreground">Bulk data operations · frontend simulation (no persistence)</p></div>

      <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
        {(["import", "export"] as const).map((t) => <button key={t} type="button" onClick={() => setTab(t)} className={`flex items-center gap-1 rounded px-3 py-1 text-sm font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t === "import" ? <Upload className="size-3.5" /> : <Download className="size-3.5" />} {t}</button>)}
      </div>

      {tab === "import" ? (
        <div className="flex flex-col gap-md">
          <div className="flex items-end gap-xs"><div><label className="mb-0.5 block text-xs text-muted-foreground">Module</label><Select value={importModule} onValueChange={setImportModule}><SelectTrigger aria-label="Import module" className="w-44"><SelectValue /></SelectTrigger><SelectContent>{IMPORT_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div><Button size="sm" variant="outline"><Download className="size-3.5" /> Download template</Button></div>
          {/* Wizard steps */}
          <ol className="flex items-center gap-1 overflow-x-auto text-xs">
            {STEPS.map((s, i) => <li key={s} className="flex items-center gap-1"><span className="whitespace-nowrap rounded-pill bg-surface-secondary px-2 py-1 font-medium text-muted-foreground">{i + 1}. {s}</span>{i < STEPS.length - 1 && <span className="text-muted-foreground">→</span>}</li>)}
          </ol>
          <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface p-2xl text-center">
            <Upload className="size-8 text-muted-foreground" />
            <p className="text-sm text-foreground">Drop a {importModule} CSV/XLSX here</p>
            <p className="text-xs text-muted-foreground">Upload is a placeholder — validation runs on mock rows.</p>
          </div>
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Recent imports</h2>
            <div className="flex flex-col gap-xs">
              {admin.imports.map((im) => (
                <div key={im.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                  <div className="min-w-0"><p className="truncate text-foreground">{im.fileName} · {im.module}</p><p className="text-xs text-muted-foreground">{im.rows} rows · {im.valid} valid · {im.errors} errors · {formatDateTime(im.createdAt)}</p></div>
                  <Badge tone={im.errors > 0 ? "warning" : im.status === "completed" ? "success" : "info"}>{im.status}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              <div><label className="mb-0.5 block text-xs text-muted-foreground">Module</label><Select value={exportModule} onValueChange={setExportModule}><SelectTrigger aria-label="Export module"><SelectValue /></SelectTrigger><SelectContent>{EXPORT_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
              <div><label className="mb-0.5 block text-xs text-muted-foreground">Format</label><Select value={format} onValueChange={(v) => setFormat(v as "csv" | "xlsx" | "pdf")}><SelectTrigger aria-label="Format"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="csv">CSV</SelectItem><SelectItem value="xlsx">XLSX</SelectItem><SelectItem value="pdf">PDF</SelectItem></SelectContent></Select></div>
            </div>
            <p className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> Exports may contain personal data — handle per your data protection policy.</p>
            <Button size="sm" onClick={() => { startExport(exportModule, format, 100 + Math.floor(Math.random() * 900)); force((n) => n + 1); }}>Generate export (simulation)</Button>
          </div>
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Recent exports</h2>
            <div className="flex flex-col gap-xs">
              {admin.exports.map((ex) => (
                <div key={ex.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><div className="min-w-0"><p className="truncate text-foreground">{ex.module} · {ex.format.toUpperCase()}</p><p className="text-xs text-muted-foreground">{ex.rows} rows · {formatDateTime(ex.createdAt)}</p></div><Badge tone={ex.status === "generating" ? "warning" : "success"}>{ex.status}</Badge></div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
