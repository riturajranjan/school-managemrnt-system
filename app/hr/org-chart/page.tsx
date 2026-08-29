"use client";

// Real PostgreSQL/API cutover (Production migration, Phase B) — reads real
// Staff rows via GET /api/staff. The hierarchy is derived from the real
// Staff.reportsToStaffId self-relation (set from a staff member's detail
// page) — never a hardcoded structure.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { StaffListItemDto } from "@/lib/api/contracts";

export default function OrgChartPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: staff, loading, error } = useStaffList({ status: "active", pageSize: 500 });
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const childrenOf = useMemo(() => {
    const map = new Map<string, StaffListItemDto[]>();
    for (const s of staff) {
      const key = s.reportsToStaffId ?? "root";
      const list = map.get(key) ?? [];
      list.push(s);
      map.set(key, list);
    }
    return map;
  }, [staff]);

  if (!capabilitiesLoading && !hasServerPermission("hr.view")) return <PermissionDenied action="view the organization chart" role={roleLabels[role]} backHref="/hr" />;

  const staffIds = new Set(staff.map((s) => s.id));
  // A "root" is anyone with no manager, OR whose manager isn't in the current (active-staff) result set.
  const roots = staff.filter((s) => !s.reportsToStaffId || !staffIds.has(s.reportsToStaffId));
  const q = query.trim().toLowerCase();

  function matches(s: StaffListItemDto): boolean {
    return q === "" || s.name.toLowerCase().includes(q) || (s.designation ?? "").toLowerCase().includes(q);
  }

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function renderNode(s: StaffListItemDto, depth: number): React.ReactNode {
    const kids = childrenOf.get(s.id) ?? [];
    const isCollapsed = collapsed.has(s.id);
    const highlight = q !== "" && matches(s);
    return (
      <div key={s.id}>
        <div className="flex items-center gap-1" style={{ paddingLeft: `${depth * 16}px` }}>
          {kids.length > 0 ? (
            <button type="button" onClick={() => toggle(s.id)} className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-secondary" aria-label={isCollapsed ? "Expand" : "Collapse"}>
              {isCollapsed ? <ChevronRight className="size-4" /> : <ChevronDown className="size-4" />}
            </button>
          ) : (
            <span className="inline-block size-6" aria-hidden="true" />
          )}
          <Link href={`/hr/staff/${s.id}`} className={`flex min-w-0 flex-1 items-center gap-sm rounded-md border p-sm transition-colors ${highlight ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40"}`}>
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{s.name.slice(0, 2).toUpperCase()}</span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{s.name}</span>
              <span className="block truncate text-xs text-muted-foreground">{s.designation ?? "—"}</span>
            </span>
            {s.department && <Badge tone="neutral">{s.department}</Badge>}
          </Link>
        </div>
        {!isCollapsed && kids.length > 0 && (
          <div className="mt-1 flex flex-col gap-1 border-l border-border/60" style={{ marginLeft: `${depth * 16 + 12}px` }}>
            {kids.map((k) => renderNode(k, depth + 1))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Organization chart</h1>
        <p className="text-xs text-muted-foreground">Real reporting structure · set a staff member&apos;s manager from their profile</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search employee or role…" className="pl-8" aria-label="Search org chart" />
      </div>

      {!loading && roots.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No active staff found.</p>
      ) : (
        <div className="flex flex-col gap-1 overflow-x-auto">{roots.map((r) => renderNode(r, 0))}</div>
      )}
    </div>
  );
}
