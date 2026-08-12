"use client";

// Super Admin permissions — the REAL platform role → area capability matrix,
// derived server-side from the authz catalog (PERMISSIONS + PLATFORM_ROLE_
// PERMISSIONS) via GET /api/super-admin/permissions. This is an accurate,
// read-only reference of what the platform DOES enforce (requirePermission on
// every platform API) — not a frontend simulation. Same table/card design.
import { useMemo, useState } from "react";
import { Check, Minus, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiResource } from "@/lib/hooks/api/use-api";
import type { PlatformPermissionMatrixDto } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

export default function PlatformPermissionsPage() {
  const { data, loading, error } = useApiResource<PlatformPermissionMatrixDto>("/api/super-admin/permissions");
  const roles = useMemo(() => data?.roles ?? [], [data]);
  const areas = useMemo(() => data?.areas ?? [], [data]);
  const [role, setRole] = useState<string>("");
  const activeRole = role || roles[0]?.key || "";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-end sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ShieldCheck className="size-5 text-primary" /> Super Admin permissions</h1><p className="text-xs text-muted-foreground">Platform role access matrix · enforced server-side</p></div>
        {roles.length > 0 && (
          <Select value={activeRole} onValueChange={setRole}><SelectTrigger aria-label="Role" className="w-52"><SelectValue /></SelectTrigger><SelectContent>{roles.map((r) => <SelectItem key={r.key} value={r.key}>{r.label}</SelectItem>)}</SelectContent></Select>
        )}
      </div>

      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading permissions…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load permissions: {error}</div>}

      {data && !loading && (
        <>
          {/* Desktop matrix */}
          <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
            <table className="w-full min-w-max text-sm">
              <thead><tr className="border-b border-border bg-surface-secondary/60 text-xs text-muted-foreground"><th className="px-sm py-2 text-left">Area</th>{roles.map((r) => <th key={r.key} className={cn("px-sm py-2 text-center", r.key === activeRole && "text-primary")}>{r.label.split(" ")[0]}</th>)}</tr></thead>
              <tbody>
                {areas.map((a) => (
                  <tr key={a.key} className="border-b border-border/60">
                    <th scope="row" className="px-sm py-2 text-left font-medium text-foreground">{a.label}</th>
                    {roles.map((r) => { const lvl = data.matrix[r.key]?.[a.key] ?? null; return <td key={r.key} className={cn("px-sm py-2 text-center", r.key === activeRole && "bg-primary/5")}>{lvl === "manage" ? <Check className="mx-auto size-4 text-success" /> : lvl === "view" ? <span className="text-xs text-info">view</span> : <Minus className="mx-auto size-3.5 text-muted-foreground" />}</td>; })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile — selected role cards */}
          <div className="flex flex-col gap-xs sm:hidden">
            {areas.map((a) => { const lvl = data.matrix[activeRole]?.[a.key] ?? null; return <div key={a.key} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm"><span className="text-foreground">{a.label}</span><span className={cn("rounded-pill px-2 py-0.5 text-[11px]", lvl === "manage" ? "bg-success/10 text-success" : lvl === "view" ? "bg-info/10 text-info" : "bg-surface-secondary text-muted-foreground")}>{lvl ?? "none"}</span></div>; })}
          </div>
          <p className="text-xs text-muted-foreground">Derived from the real permission catalog and enforced on every platform API.</p>
        </>
      )}
    </div>
  );
}
