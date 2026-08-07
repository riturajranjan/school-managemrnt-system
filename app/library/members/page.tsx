"use client";

import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { reinstateMember, suspendMember } from "@/lib/services/library-member-service";
import { addMoney, formatMoney, zeroMoney } from "@/lib/finance/money";
import { fineOutstanding } from "@/lib/services/library-fine-service";
import { roleLabels } from "@/lib/permissions/roles";
import { memberStatusLabels, memberTypeLabels, type LibraryMember, type MemberStatus } from "@/lib/types/library";

const statusTone: Record<MemberStatus, "success" | "warning" | "error" | "neutral"> = {
  active: "success",
  suspended: "error",
  expired: "warning",
  inactive: "neutral",
};

export default function MembersPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Librarian", role: roleLabels[role] };
  const [query, setQuery] = useState("");
  const [, force] = useState(0);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.libraryMembers.filter((m) => (q ? m.name.toLowerCase().includes(q) || m.membershipId.toLowerCase().includes(q) : true));
  }, [db.libraryMembers, query]);

  if (!can("library.view")) return <PermissionDenied action="view members" role={roleLabels[role]} />;
  const canManage = can("library.manageMembers");

  const activeLoanCount = (id: string) => db.libraryLoans.filter((l) => l.memberId === id && (l.status === "active" || l.status === "overdue" || l.status === "renewed")).length;
  const fineBalance = (id: string) => db.libraryFines.filter((f) => f.memberId === id && (f.status === "pending" || f.status === "partially-paid")).reduce((s, f) => addMoney(s, fineOutstanding(f)), zeroMoney("INR"));

  const columns: ColumnDef<LibraryMember>[] = [
    { id: "name", header: "Member", alwaysVisible: true, sortValue: (m) => m.name, cell: (m) => (
      <div className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{m.name}</p>
        <p className="truncate text-xs text-muted-foreground">{m.membershipId} · {memberTypeLabels[m.type]}</p>
      </div>
    ) },
    { id: "class", header: "Class / Dept", cell: (m) => <span className="text-sm text-muted-foreground">{m.classOrDept ?? "—"}</span>, defaultVisible: false },
    { id: "loans", header: "On loan", align: "right", sortValue: (m) => activeLoanCount(m.id), cell: (m) => <span className="text-sm text-foreground">{activeLoanCount(m.id)}</span> },
    { id: "fines", header: "Fine balance", align: "right", cell: (m) => { const b = fineBalance(m.id); return <span className={`text-sm ${b.minorUnits > 0 ? "text-warning" : "text-muted-foreground"}`}>{formatMoney(b)}</span>; } },
    { id: "status", header: "Status", align: "right", cell: (m) => <Badge tone={statusTone[m.status]}>{memberStatusLabels[m.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Members</h1>
        <p className="text-xs text-muted-foreground">{db.libraryMembers.length} borrowers · students, teachers and staff</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name or membership ID…" className="pl-8" aria-label="Search members" />
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(m) => m.id}
        caption="Library members"
        isFiltered={query.trim() !== ""}
        emptyIcon={Users}
        emptyTitle="No members yet"
        rowActions={
          canManage
            ? [
                { key: "suspend", label: "Suspend borrowing", destructive: true, onSelect: (m) => { suspendMember(m.id, actor, "Suspended from members list"); force((n) => n + 1); }, hidden: (m) => m.status !== "active" },
                { key: "reinstate", label: "Reinstate", onSelect: (m) => { reinstateMember(m.id, actor); force((n) => n + 1); }, hidden: (m) => m.status === "active" },
              ]
            : undefined
        }
        renderMobileCard={(m) => {
          const b = fineBalance(m.id);
          return (
            <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-xs">
                <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                <Badge tone={statusTone[m.status]}>{memberStatusLabels[m.status]}</Badge>
              </div>
              <p className="text-xs text-muted-foreground">{m.membershipId} · {memberTypeLabels[m.type]}</p>
              <p className="text-xs text-muted-foreground">{activeLoanCount(m.id)} on loan · {formatMoney(b)} fines</p>
            </div>
          );
        }}
      />
    </div>
  );
}
