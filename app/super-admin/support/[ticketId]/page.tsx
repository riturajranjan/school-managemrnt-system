"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSisStore } from "@/lib/hooks/use-store";
import { replyTicket, setTicketStatus } from "@/lib/services/saas-service";
import { tenantHealth, healthLabels, healthTone } from "@/lib/selectors/saas-brief";
import { supportCategoryLabels, supportStatusTone } from "@/lib/types/saas";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function Support360Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const db = useSisStore();
  const [, force] = useState(0);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);

  const t = db.saas.support.find((x) => x.id === ticketId);
  const tenant = t ? db.saas.tenants.find((x) => x.id === t.tenantId) : undefined;
  const plan = tenant ? db.saas.plans.find((p) => p.id === tenant.planId) : undefined;
  const health = tenant ? tenantHealth(db.saas, tenant) : null;

  if (!t) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Ticket not found. <Link href="/super-admin/support" className="text-primary">Back</Link></div>;
  const bump = () => force((n) => n + 1);
  const send = () => { if (replyTicket(t.id, reply, internal).ok) { setReply(""); bump(); } };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/support"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h1 className="truncate text-lg font-semibold text-foreground">{t.subject}</h1><Badge tone={supportStatusTone[t.status]}>{t.status}</Badge></div><p className="text-xs text-muted-foreground">{t.reference} · {supportCategoryLabels[t.category]} · {t.priority}</p></div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_280px]">
        {/* Conversation */}
        <div className="flex flex-col gap-sm">
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            {t.messages.map((m) => (
              <div key={m.id} className={cn("rounded-md border p-sm text-sm", m.internal ? "border-warning/30 bg-warning/8" : "border-border bg-surface-secondary/30")}>
                <div className="mb-1 flex items-center justify-between"><span className="flex items-center gap-1 text-xs font-medium text-foreground">{m.internal && <Lock className="size-3 text-warning" />}{m.author}</span><span className="text-[10px] text-muted-foreground">{formatDateTime(m.at)}</span></div>
                <p className="text-foreground">{m.text}</p>
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
            <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? "Internal note…" : "Reply to school…"} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note</label>
              <Button size="sm" onClick={send} disabled={!reply.trim()}>{internal ? "Add note" : "Reply (simulation)"}</Button>
            </div>
          </div>
          <div className="flex flex-wrap gap-xs">
            {t.status !== "escalated" && <Button size="sm" variant="outline" onClick={() => { setTicketStatus(t.id, "escalated"); bump(); }}>Escalate</Button>}
            {t.status !== "resolved" && <Button size="sm" variant="outline" onClick={() => { setTicketStatus(t.id, "resolved"); bump(); }}>Resolve</Button>}
            {t.status !== "closed" && <Button size="sm" variant="ghost" onClick={() => { setTicketStatus(t.id, "closed"); bump(); }}>Close</Button>}
          </div>
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-sm">
          <div className="rounded-lg border border-border bg-surface p-md text-sm">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Tenant</h2>
            {tenant && <Link href={`/super-admin/schools/${tenant.id}`} className="text-primary">{tenant.name}</Link>}
            <dl className="mt-sm grid grid-cols-2 gap-y-1 text-xs"><dt className="text-muted-foreground">Plan</dt><dd className="text-foreground">{plan?.name}</dd><dt className="text-muted-foreground">Owner</dt><dd className="text-foreground">{tenant?.ownerName}</dd><dt className="text-muted-foreground">Assigned</dt><dd className="text-foreground">{t.assignedTo}</dd>{health && <><dt className="text-muted-foreground">Health</dt><dd><Badge tone={healthTone[health.state]}>{healthLabels[health.state]}</Badge></dd></>}</dl>
          </div>
        </div>
      </div>
    </div>
  );
}
