"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmployeeAvatar } from "@/components/hr/employee-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import type { Employee } from "@/lib/types/hr";

export default function OrgChartPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const childrenOf = useMemo(() => {
    const map = new Map<string, Employee[]>();
    for (const e of db.employees) {
      if (e.status === "resigned" || e.status === "retired") continue;
      const key = e.reportingManagerId ?? "root";
      const list = map.get(key) ?? [];
      list.push(e);
      map.set(key, list);
    }
    return map;
  }, [db.employees]);

  if (!can("hr.view")) return <PermissionDenied action="view the organization chart" role={roleLabels[role]} backHref="/hr" />;

  const roots = db.employees.filter((e) => !e.reportingManagerId && e.status !== "resigned" && e.status !== "retired");
  const q = query.trim().toLowerCase();
  const deptName = (id: string) => db.departments.find((d) => d.id === id)?.name ?? "";
  const desigTitle = (id: string) => db.designations.find((d) => d.id === id)?.title ?? "";
  const deptTone = (id: string) => db.departments.find((d) => d.id === id)?.colorTone ?? "neutral";

  function matches(e: Employee): boolean {
    return q === "" || `${e.firstName} ${e.lastName}`.toLowerCase().includes(q) || desigTitle(e.designationId).toLowerCase().includes(q);
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(e: Employee, depth: number): React.ReactNode {
    const kids = childrenOf.get(e.id) ?? [];
    const isCollapsed = collapsed.has(e.id);
    const highlight = q !== "" && matches(e);
    return (
      <div key={e.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          {kids.length > 0 ? (
            <button type="button" onClick={() => toggle(e.id)} className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-secondary" aria-label={isCollapsed ? "Expand" : "Collapse"}>
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          ) : (
            <span className="inline-block size-6" aria-hidden="true" />
          )}
          <Link href={`/hr/staff/${e.id}`} className={`flex min-w-0 flex-1 items-center gap-sm rounded-md border p-sm transition-colors ${highlight ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40"}`}>
            <EmployeeAvatar firstName={e.firstName} lastName={e.lastName} color={e.photoColor} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{e.firstName} {e.lastName}</span>
              <span className="block truncate text-xs text-muted-foreground">{desigTitle(e.designationId)}</span>
            </span>
            <Badge tone={deptTone(e.departmentId)}>{deptName(e.departmentId)}</Badge>
          </Link>
        </div>
        {!isCollapsed && kids.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-l border-border/60" style={{ marginLeft: `${depth * 16 + 12}px` }}>
            {kids.sort((a, b) => (db.designations.find((d) => d.id === a.designationId)?.level ?? 9) - (db.designations.find((d) => d.id === b.designationId)?.level ?? 9)).map((k) => renderNode(k, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Organization chart</h1>
        <p className="text-xs text-muted-foreground">Reporting structure · tap to expand, search to highlight</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee or role…" className="pl-8" aria-label="Search org chart" />
      </div>

      <div className="flex flex-col gap-1 overflow-x-auto">{roots.map((r) => renderNode(r, 0))}</div>
    </div>
  );
}
