"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Send, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { assignTicket, replyToTicket, setTicketPriority, setTicketStatus } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import {
  participantRoleLabels,
  ticketCategoryLabels,
  ticketPriorityTone,
  ticketStatusLabels,
  ticketStatusTone,
  type TicketPriority,
  type TicketStatus,
} from "@/lib/types/communication";
import { cn, formatDateTime } from "@/lib/utils";

export default function TicketWorkspacePage({ params }: { params: Promise<{ ticketId: string }> }) {
  const { ticketId } = use(params);
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [, force] = useState(0);

  const ticket = db.helpdeskTickets.find((t) => t.id === ticketId);
  if (!can("helpdesk.view") && !can("helpdesk.viewOwn")) return <PermissionDenied action="view tickets" role={roleLabels[role]} backHref="/helpdesk/tickets" />;
  if (!ticket) return <div className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Ticket not found. <Link href="/helpdesk/tickets" className="text-primary">Back</Link></div>;

  const canManage = can("helpdesk.manage");
  const replies = db.ticketReplies.filter((r) => r.ticketId === ticket.id).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const student = ticket.studentId ? db.students.find((s) => s.id === ticket.studentId) : undefined;
  const related = db.helpdeskTickets.filter((t) => t.id !== ticket.id && t.category === ticket.category).slice(0, 3);

  function submit() {
    if (!reply.trim()) return;
    replyToTicket(ticket!.id, reply, internal);
    setReply("");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/helpdesk/tickets"><ArrowLeft className="size-4" /></Link></Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{ticket.subject}</h1>
          <p className="truncate text-xs text-muted-foreground">{ticket.reference} · {ticketCategoryLabels[ticket.category]}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Conversation */}
        <div className="flex flex-col gap-sm">
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            {replies.map((r) => (
              <div key={r.id} className={cn("rounded-lg border p-sm", r.internal ? "border-dashed border-warning/50 bg-warning/8" : r.fromStaff ? "border-primary/20 bg-primary/5" : "border-border bg-surface-secondary/40")}>
                {r.internal && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning"><Star className="size-3" /> Internal note</p>}
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium text-foreground">{r.authorName}{r.fromStaff ? " · Staff" : ""}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDateTime(r.createdAt)}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{r.body}</p>
              </div>
            ))}
          </div>

          {canManage && ticket.status !== "closed" && (
            <div className="rounded-lg border border-border bg-surface p-sm">
              {internal && <p className="mb-1 text-xs font-medium text-warning">Internal note — not visible to the requester</p>}
              <div className="flex items-end gap-xs">
                <button type="button" onClick={() => setInternal((v) => !v)} className={cn("flex size-9 items-center justify-center rounded-md", internal ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-surface-secondary")} aria-label="Toggle internal note"><Star className="size-4" /></button>
                <Input value={reply} onChange={(e) => setReply(e.target.value)} onKeyDown={(e) => e.key === "Enter" && submit()} placeholder={internal ? "Add an internal note…" : "Reply to the requester…"} aria-label="Reply" />
                <Button size="icon" onClick={submit} disabled={!reply.trim()} aria-label="Send reply"><Send className="size-4" /></Button>
              </div>
            </div>
          )}
        </div>

        {/* Details sidebar */}
        <div className="flex flex-col gap-md">
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Details</h2>
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Requester" value={`${ticket.requesterName} (${participantRoleLabels[ticket.requesterRole]})`} />
              {student && <Row label="Student" value={`${student.profile.firstName} ${student.profile.lastName} · ${student.classId}`} />}
              <Row label="Team" value={ticket.assignedTeam} />
              <Row label="Assigned to" value={ticket.assignedTo ?? "Unassigned"} />
              <Row label="SLA target" value={`${ticket.slaHours}h`} />
            </dl>
            <div className="mt-sm flex flex-wrap items-center gap-xs">
              <Badge tone={ticketPriorityTone[ticket.priority]}>{ticket.priority}</Badge>
              <Badge tone={ticketStatusTone[ticket.status]}>{ticketStatusLabels[ticket.status]}</Badge>
            </div>
          </div>

          {canManage && (
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Actions</h2>
              <div className="flex flex-col gap-sm">
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Status</label>
                  <Select value={ticket.status} onValueChange={(v) => { setTicketStatus(ticket.id, v as TicketStatus); force((n) => n + 1); }}>
                    <SelectTrigger aria-label="Status"><SelectValue /></SelectTrigger>
                    <SelectContent>{(Object.keys(ticketStatusLabels) as TicketStatus[]).map((s) => <SelectItem key={s} value={s}>{ticketStatusLabels[s]}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="mb-1 block text-xs text-muted-foreground">Priority</label>
                  <Select value={ticket.priority} onValueChange={(v) => { setTicketPriority(ticket.id, v as TicketPriority); force((n) => n + 1); }}>
                    <SelectTrigger aria-label="Priority"><SelectValue /></SelectTrigger>
                    <SelectContent>{(["low", "normal", "high", "urgent"] as TicketPriority[]).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap gap-xs">
                  {!ticket.assignedTo && <Button size="sm" variant="outline" onClick={() => { assignTicket(ticket.id, "Support Agent"); force((n) => n + 1); }}>Assign to me</Button>}
                  {ticket.status !== "escalated" && <Button size="sm" variant="ghost" onClick={() => { setTicketStatus(ticket.id, "escalated"); force((n) => n + 1); }}>Escalate</Button>}
                  {ticket.status !== "resolved" && <Button size="sm" variant="ghost" onClick={() => { setTicketStatus(ticket.id, "resolved"); force((n) => n + 1); }}>Resolve</Button>}
                </div>
              </div>
            </div>
          )}

          {related.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-md">
              <h2 className="mb-sm text-sm font-semibold text-foreground">Related tickets</h2>
              <div className="flex flex-col gap-xs">
                {related.map((r) => (
                  <Link key={r.id} href={`/helpdesk/tickets/${r.id}`} className="truncate text-xs text-primary hover:underline">{r.reference} · {r.subject}</Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium text-foreground">{value}</dd>
    </div>
  );
}
