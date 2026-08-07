"use client";

import Link from "next/link";
import { Tag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { ticketCategoryLabels, type TicketCategory } from "@/lib/types/communication";

export default function HelpdeskCategoriesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("helpdesk.view")) return <PermissionDenied action="view helpdesk categories" role={roleLabels[role]} backHref="/helpdesk" />;

  const cats = Object.keys(ticketCategoryLabels) as TicketCategory[];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Ticket categories</h1>
        <p className="text-xs text-muted-foreground">Support routing categories and open volumes</p>
      </div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {cats.map((c) => {
          const all = db.helpdeskTickets.filter((t) => t.category === c);
          const open = all.filter((t) => t.status !== "resolved" && t.status !== "closed").length;
          const team = all[0]?.assignedTeam ?? "—";
          return (
            <Link key={c} href="/helpdesk/tickets" className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md hover:border-primary/40">
              <div className="flex items-center gap-sm">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Tag className="size-4" /></span>
                <div>
                  <p className="text-sm font-semibold text-foreground">{ticketCategoryLabels[c]}</p>
                  <p className="text-xs text-muted-foreground">Team: {team}</p>
                </div>
              </div>
              <Badge tone={open > 0 ? "warning" : "success"}>{open} open</Badge>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
