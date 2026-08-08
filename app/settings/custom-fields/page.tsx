"use client";

import { useMemo, useState } from "react";
import { ListChecks } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useCustomFields } from "@/lib/hooks/use-admin";
import { toggleCustomField } from "@/lib/services/admin-service";
import { customFieldTypeLabels } from "@/lib/types/admin";
import { roleLabels } from "@/lib/permissions/roles";

const MODULES = ["All", "Student", "Parent", "Staff", "Admission", "Fees", "Transport", "Library", "Assets", "Health", "Hostel"];

export default function CustomFieldsPage() {
  const { role } = usePermissions();
  const fields = useCustomFields();
  const [, force] = useState(0);
  const [module, setModule] = useState("All");

  const rows = useMemo(() => (module === "All" ? fields : fields.filter((f) => f.module === module)), [fields, module]);
  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage custom fields" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ListChecks className="size-5 text-primary" /> Custom fields</h1><p className="text-xs text-muted-foreground">{fields.length} fields · extend module records</p></div>

      <div className="flex flex-wrap gap-1">
        {MODULES.map((m) => <button key={m} type="button" onClick={() => setModule(m)} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${module === m ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{m}</button>)}
      </div>

      <div className="flex flex-col gap-xs">
        {rows.map((f) => (
          <div key={f.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2"><p className="text-sm font-medium text-foreground">{f.label}</p><code className="rounded bg-surface-secondary px-1 text-[10px] text-muted-foreground">{f.key}</code>{f.required && <Badge tone="warning">Required</Badge>}</div>
              <p className="text-xs text-muted-foreground">{f.module} · {customFieldTypeLabels[f.type]}{f.options.length > 0 ? ` · ${f.options.length} options` : ""}{f.helpText ? ` · ${f.helpText}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <Badge tone="neutral">{f.visibility}</Badge>
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={f.status === "active"} onChange={() => { toggleCustomField(f.id); force((n) => n + 1); }} aria-label={`Toggle ${f.label}`} /> {f.status === "active" ? "Active" : "Inactive"}</label>
            </div>
          </div>
        ))}
        {rows.length === 0 && <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No custom fields for this module.</div>}
      </div>
      <Button size="sm" variant="outline" disabled className="self-start" title="Add field (simulation)">+ Add custom field</Button>
    </div>
  );
}
