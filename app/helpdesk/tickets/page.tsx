"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LifeBuoy, Search } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { ticketCategoryLabels, ticketPriorityTone, ticketStatusLabels, ticketStatusTone, type HelpdeskTicket, type TicketStatus } from "@/lib/types/communication";
import { timeAgo } from "@/lib/utils";

export default function TicketListPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("open");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.helpdeskTickets
      .filter((t) => (status === "all" ? true : status === "open" ? t.status !== "resolved" && t.status !== "closed" : t.status === status))
      .filter((t) => (q ? t.subject.toLowerCase().includes(q) || t.reference.toLowerCase().includes(q) || t.requesterName.toLowerCase().includes(q) : true))
      .sort((a, b) => b.lastActivityAt.localeCompare(a.lastActivityAt));
  }, [db.helpdeskTickets, query, status]);

  if (!can("helpdesk.view") && !can("helpdesk.viewOwn")) return <PermissionDenied action="view tickets" role={roleLabels[role]} backHref="/helpdesk" />;

  const columns: ColumnDef<HelpdeskTicket>[] = [
    { id: "subject", header: "Ticket", alwaysVisible: true, sortValue: (t) => t.subject, cell: (t) => (
      <Link href={`/helpdesk/tickets/${t.id}`} className="min-w-0">
        <p className="truncate text-sm font-medium text-foreground hover:underline">{t.subject}</p>
        <p className="truncate text-xs text-muted-foreground">{t.reference} · {t.requesterName}</p>
      </Link>
    ) },
    { id: "category", header: "Category", cell: (t) => <span className="text-sm text-muted-foreground">{ticketCategoryLabels[t.category]}</span> },
    { id: "team", header: "Team", cell: (t) => <span className="text-sm text-muted-foreground">{t.assignedTeam}</span>, defaultVisible: false },
    { id: "priority", header: "Priority", cell: (t) => <Badge tone={ticketPriorityTone[t.priority]}>{t.priority}</Badge> },
    { id: "activity", header: "Activity", align: "right", sortValue: (t) => t.lastActivityAt, cell: (t) => <span className="text-xs text-muted-foreground">{timeAgo(t.lastActivityAt)}</span> },
    { id: "status", header: "Status", align: "right", cell: (t) => <Badge tone={ticketStatusTone[t.status]}>{ticketStatusLabels[t.status]}</Badge> },
  ];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Tickets</h1>
        <p className="text-xs text-muted-foreground">{db.helpdeskTickets.length} tickets</p>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search subject, ref or requester…" className="pl-8" aria-label="Search tickets" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40" aria-label="Filter status"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="all">All</SelectItem>
            {(Object.keys(ticketStatusLabels) as TicketStatus[]).map((s) => <SelectItem key={s} value={s}>{ticketStatusLabels[s]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(t) => t.id}
        caption="Helpdesk tickets"
        isFiltered={query.trim() !== "" || status !== "open"}
        emptyIcon={LifeBuoy}
        emptyTitle="No tickets found"
        renderMobileCard={(t) => (
          <Link href={`/helpdesk/tickets/${t.id}`} className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
            <div className="flex items-center justify-between gap-xs">
              <p className="truncate text-sm font-semibold text-foreground">{t.subject}</p>
              <Badge tone={ticketStatusTone[t.status]}>{ticketStatusLabels[t.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{t.reference} · {t.requesterName} · {ticketCategoryLabels[t.category]}</p>
            <div className="flex items-center gap-2"><Badge tone={ticketPriorityTone[t.priority]}>{t.priority}</Badge><span className="text-xs text-muted-foreground">{timeAgo(t.lastActivityAt)}</span></div>
          </Link>
        )}
      />
    </div>
  );
}
