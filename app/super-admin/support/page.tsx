"use client";

// Real platform support tickets (Super Admin SA-4I). Reads GET /api/super-admin/
// support/tickets — real DB rows against real Tenants/Schools. No mock store.
import Link from "next/link";
import { useState } from "react";
import { LifeBuoy, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTicketList, createTicketRequest } from "@/lib/hooks/api/use-support";
import { useSchoolList } from "@/lib/hooks/api/use-platform-schools";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  SUPPORT_CATEGORIES,
  SUPPORT_PRIORITIES,
  SUPPORT_STATUSES,
  supportCategoryLabel,
  supportPriorityTone,
  supportStatusLabel,
  supportStatusTone,
} from "@/lib/plans/support-status";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function SupportPage() {
  const { can } = usePermissions();
  const manage = can("platform.support.manage");
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 250);
  const [status, setStatus] = useState<(typeof SUPPORT_STATUSES)[number]>("all");
  const [escalated, setEscalated] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [msg, setMsg] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const { data: rows, meta, loading, error, reload } = useTicketList({ pageSize: 100, search: debounced || undefined, status, escalated, sort: "updatedAt", order: "desc" });

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <LifeBuoy className="size-5 text-primary" /> Support &amp; success
          </h1>
          <p className="text-xs text-muted-foreground">{meta ? `${meta.total} tickets` : "…"} · platform-level (separate from school helpdesk)</p>
        </div>
        {manage && (
          <Button size="sm" onClick={() => setShowForm((v) => !v)}>
            <Plus className="size-3.5" /> New ticket
          </Button>
        )}
      </div>

      {showForm && manage && <NewTicketForm onDone={(m) => { setMsg(m); setShowForm(false); reload(); }} onCancel={() => setShowForm(false)} />}

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search ticket #, subject, school, tenant…"
          aria-label="Search tickets"
          className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary sm:max-w-xs"
        />
        <div className="flex flex-wrap gap-1">
          {SUPPORT_STATUSES.map((s) => (
            <button key={s} type="button" onClick={() => setStatus(s)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", status === s ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>
              {s === "all" ? "All" : supportStatusLabel(s)}
            </button>
          ))}
          <button type="button" onClick={() => setEscalated((v) => !v)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", escalated ? "bg-error text-white" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>
            Escalated
          </button>
        </div>
      </div>

      {msg && <p className={msg.tone === "success" ? "rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success" : "rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error"}>{msg.text}</p>}

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load tickets: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      ) : loading && rows.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading tickets…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No tickets match your filters.</div>
      ) : (
        <div className="flex flex-col gap-xs">
          {rows.map((t) => (
            <Link key={t.id} href={`/super-admin/support/${t.id}`} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm text-sm transition hover:border-primary/40 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-foreground">{t.subject}</p>
                  <Badge tone={supportPriorityTone(t.priority)}>{t.priority}</Badge>
                  {t.escalated && <Badge tone="error">Escalated</Badge>}
                </div>
                <p className="truncate text-xs text-muted-foreground">
                  {t.ticketNumber} · {t.school?.name ?? t.tenant.name} · {supportCategoryLabel(t.category)} · {t.assignedTo?.name ?? "Unassigned"}
                </p>
              </div>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="hidden sm:inline">{formatDateTime(t.updatedAt)}</span>
                <Badge tone={supportStatusTone(t.status)}>{supportStatusLabel(t.status)}</Badge>
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function NewTicketForm({ onDone, onCancel }: { onDone: (m: { tone: "success" | "error"; text: string }) => void; onCancel: () => void }) {
  const [schoolId, setSchoolId] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("other");
  const [priority, setPriority] = useState("medium");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data: schools } = useSchoolList({ pageSize: 100 });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!schoolId) return setErr("Select a school.");
    if (!subject.trim() || !description.trim()) return setErr("Subject and description are required.");
    setSubmitting(true);
    const res = await createTicketRequest({ schoolId, subject: subject.trim(), description: description.trim(), category, priority });
    setSubmitting(false);
    if (!res.success) return setErr(res.error.message);
    onDone({ tone: "success", text: `Ticket ${res.data.ticketNumber} created.` });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
      {err && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{err}</p>}
      <div>
        <Label htmlFor="tk-school">School *</Label>
        <select id="tk-school" value={schoolId} onChange={(e) => setSchoolId(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground">
          <option value="">Select a school…</option>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code}) · {s.tenantName}</option>)}
        </select>
      </div>
      <div>
        <Label htmlFor="tk-subject">Subject *</Label>
        <Input id="tk-subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="tk-desc">Description *</Label>
        <textarea id="tk-desc" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-sm">
        <div>
          <Label htmlFor="tk-cat">Category</Label>
          <select id="tk-cat" value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground">
            {SUPPORT_CATEGORIES.map((c) => <option key={c} value={c}>{supportCategoryLabel(c)}</option>)}
          </select>
        </div>
        <div>
          <Label htmlFor="tk-prio">Priority</Label>
          <select id="tk-prio" value={priority} onChange={(e) => setPriority(e.target.value)} className="h-9 w-full rounded-md border border-border bg-surface px-2 text-sm text-foreground capitalize">
            {SUPPORT_PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-sm">
        <Button type="button" variant="outline" disabled={submitting} onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={submitting}>{submitting ? "Creating…" : "Create ticket"}</Button>
      </div>
    </form>
  );
}
