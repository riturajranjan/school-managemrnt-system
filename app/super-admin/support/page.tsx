"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LifeBuoy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSisStore } from "@/lib/hooks/use-store";
import { supportCategoryLabels, supportStatusTone, type SupportTicketStatus } from "@/lib/types/saas";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const STATUSES: (SupportTicketStatus | "all")[] = ["all", "open", "in-progress", "waiting", "escalated", "resolved"];
const prioTone = { low: "neutral", normal: "info", high: "warning", urgent: "error" } as const;

export default function SupportPage() {
  const db = useSisStore();
  const [status, setStatus] = useState<SupportTicketStatus | "all">("all");
  const tenantName = (id: string) => db.saas.tenants.find((t) => t.id === id)?.name ?? id;
  const planName = (tid: string) => { const t = db.saas.tenants.find((x) => x.id === tid); return t ? db.saas.plans.find((p) => p.id === t.planId)?.name : ""; };
  const rows = useMemo(() => [...db.saas.support].filter((t) => (status === "all" ? true : t.status === status)).sort((a, b) => b.lastActivity.localeCompare(a.lastActivity)), [db.saas.support, status]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><LifeBuoy className="size-5 text-primary" /> Support & success</h1><p className="text-xs text-muted-foreground">{rows.length} tickets · platform-level (separate from school helpdesk)</p></div>
      <div className="flex flex-wrap gap-1">{STATUSES.map((s) => <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{s === "all" ? "All" : s}</button>)}</div>

      <div className="flex flex-col gap-xs">
        {rows.map((t) => (
          <Link key={t.id} href={`/super-admin/support/${t.id}`} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium text-foreground">{t.subject}</p><Badge tone={prioTone[t.priority]}>{t.priority}</Badge></div><p className="truncate text-xs text-muted-foreground">{t.reference} · {tenantName(t.tenantId)} ({planName(t.tenantId)}) · {supportCategoryLabels[t.category]} · {t.assignedTo}</p></div>
            <span className="flex items-center gap-2 text-xs text-muted-foreground"><span className="hidden sm:inline">{formatDateTime(t.lastActivity)}</span><Badge tone={supportStatusTone[t.status]}>{t.status}</Badge></span>
          </Link>
        ))}
      </div>
    </div>
  );
}
