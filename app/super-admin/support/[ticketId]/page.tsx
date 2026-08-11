"use client";

// Real support ticket detail (Super Admin SA-4I). Reads GET /api/super-admin/
// support/tickets/:id; reply/note/assign/status hit the real endpoints. The
// tenant-health badge is the real SA-4F health (no second calculation).
import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useTicket,
  useSupportAgents,
  addTicketMessageRequest,
  assignTicketRequest,
  setTicketStatusRequest,
} from "@/lib/hooks/api/use-support";
import { usePermissions } from "@/components/providers/permissions-provider";
import { healthStateLabel, healthStateTone } from "@/lib/plans/health-state";
import { SUPPORT_STATUS_TRANSITIONS, supportCategoryLabel, supportPriorityTone, supportStatusLabel, supportStatusTone } from "@/lib/plans/support-status";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function Support360Page({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const { can } = usePermissions();
  const manage = can("platform.support.manage");
  const { data: t, loading, error, reload } = useTicket(ticketId);
  const agents = useSupportAgents();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  if (loading && !t) return <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading ticket…</div>;
  if (error || !t) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error ?? "Ticket not found."} <Link href="/super-admin/support" className="text-primary">Back</Link></div>;

  async function run(fn: () => Promise<{ success: boolean; error?: { message: string } }>, okText: string) {
    setMsg(null);
    setBusy(true);
    const res = await fn();
    setBusy(false);
    if (!res.success) return setMsg({ tone: "error", text: res.error?.message ?? "Action failed" });
    setMsg({ tone: "success", text: okText });
    reload();
  }

  async function send() {
    if (!reply.trim()) return;
    setBusy(true);
    const res = await addTicketMessageRequest(t!.id, reply.trim(), internal);
    setBusy(false);
    if (!res.success) return setMsg({ tone: "error", text: res.error.message });
    setReply("");
    reload();
  }

  const nextStatuses = SUPPORT_STATUS_TRANSITIONS[t.status] ?? [];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost"><Link href="/super-admin/support"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-foreground">{t.subject}</h1>
            <Badge tone={supportStatusTone(t.status)}>{supportStatusLabel(t.status)}</Badge>
            {t.escalated && <Badge tone="error">Escalated</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">{t.ticketNumber} · {supportCategoryLabel(t.category)} · <span className="capitalize">{t.priority}</span></p>
        </div>
      </div>

      {msg && <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>{msg.text}</p>}

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="flex flex-col gap-sm">
          <div className="rounded-lg border border-border bg-surface p-md text-sm">
            <p className="mb-1 text-xs font-semibold text-muted-foreground">Description</p>
            <p className="text-foreground">{t.description}</p>
          </div>

          {/* Conversation + internal notes (merged, ordered) */}
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            {[...t.messages.map((m) => ({ ...m, internal: false })), ...t.internalNotes.map((m) => ({ ...m, internal: true }))]
              .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
              .map((m) => (
                <div key={m.id} className={cn("rounded-md border p-sm text-sm", m.internal ? "border-warning/30 bg-warning/8" : "border-border bg-surface-secondary/30")}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-xs font-medium text-foreground">{m.internal && <Lock className="size-3 text-warning" />}{m.authorName}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                  </div>
                  <p className="text-foreground">{m.body}</p>
                </div>
              ))}
            {t.messages.length === 0 && t.internalNotes.length === 0 && <p className="py-md text-center text-xs text-muted-foreground">No messages yet.</p>}
          </div>

          {manage && (
            <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm">
              <Input value={reply} onChange={(e) => setReply(e.target.value)} placeholder={internal ? "Internal note…" : "Reply…"} onKeyDown={(e) => e.key === "Enter" && send()} />
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} /> Internal note</label>
                <Button size="sm" onClick={send} disabled={busy || !reply.trim()}>{internal ? "Add note" : "Reply"}</Button>
              </div>
            </div>
          )}

          {manage && nextStatuses.length > 0 && (
            <div className="flex flex-wrap gap-xs">
              {nextStatuses.map((s) => (
                <Button key={s} size="sm" variant="outline" disabled={busy} onClick={() => run(() => setTicketStatusRequest(t.id, s), `Ticket → ${supportStatusLabel(s)}.`)}>
                  {supportStatusLabel(s)}
                </Button>
              ))}
            </div>
          )}
        </div>

        {/* Side panel */}
        <div className="flex flex-col gap-sm">
          <div className="rounded-lg border border-border bg-surface p-md text-sm">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Tenant</h2>
            {t.school ? <Link href={`/super-admin/schools/${t.school.id}`} className="text-primary">{t.school.name}</Link> : <span className="text-foreground">{t.tenant.name}</span>}
            <dl className="mt-sm grid grid-cols-2 gap-y-1.5 text-xs">
              <dt className="text-muted-foreground">Tenant</dt><dd className="text-right text-foreground">{t.tenant.name}</dd>
              <dt className="text-muted-foreground">Priority</dt><dd className="text-right"><Badge tone={supportPriorityTone(t.priority)}>{t.priority}</Badge></dd>
              <dt className="text-muted-foreground">Opened</dt><dd className="text-right text-foreground">{formatDateTime(t.openedAt)}</dd>
              <dt className="text-muted-foreground">First response</dt><dd className="text-right text-foreground">{t.firstResponseAt ? formatDateTime(t.firstResponseAt) : "—"}</dd>
              {t.health && (<><dt className="text-muted-foreground">Health</dt><dd className="text-right"><Badge tone={healthStateTone(t.health.state)}>{healthStateLabel(t.health.state)}</Badge></dd></>)}
            </dl>
          </div>

          {manage && (
            <div className="rounded-lg border border-border bg-surface p-md text-sm">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Assignment</h2>
              <select
                value={t.assignedTo?.userId ?? ""}
                onChange={(e) => run(() => assignTicketRequest(t.id, e.target.value || null), "Assignment updated.")}
                disabled={busy}
                aria-label="Assignee"
                className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground"
              >
                <option value="">Unassigned</option>
                {agents.data.map((a) => <option key={a.userId} value={a.userId}>{a.name ?? a.email} ({a.role})</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
