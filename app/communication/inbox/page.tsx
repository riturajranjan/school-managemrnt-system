"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Check,
  CheckCheck,
  Clock,
  FileText,
  Info,
  Paperclip,
  Search,
  Send,
  Smile,
  Star,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/communication/person-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { markConversationRead, sendMessage, setConversationStatus } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { conversationCategoryLabels, participantRoleLabels, type Conversation } from "@/lib/types/communication";
import { cn, formatCurrency, timeAgo } from "@/lib/utils";

const categories = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "priority", label: "Priority" },
  { key: "parents", label: "Parents" },
  { key: "students", label: "Students" },
  { key: "teachers", label: "Teachers" },
  { key: "archived", label: "Archived" },
] as const;

export default function UnifiedInboxPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [category, setCategory] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [internalMode, setInternalMode] = useState(false);
  const [, force] = useState(0);

  const participant = (id: string) => db.conversationParticipants.find((p) => p.id === id);

  const conversations = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.conversations
      .filter((c) => {
        if (category === "unread") return c.unreadCount > 0;
        if (category === "priority") return c.priority === "priority" || c.priority === "urgent";
        if (category === "archived") return c.status === "archived";
        if (category === "parents") return participant(c.counterpartId)?.role === "parent";
        if (category === "students") return participant(c.counterpartId)?.role === "student";
        if (category === "teachers") return participant(c.counterpartId)?.role === "teacher";
        return c.status !== "archived";
      })
      .filter((c) => (q ? c.subject.toLowerCase().includes(q) || (participant(c.counterpartId)?.name ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.conversations, db.conversationParticipants, category, query]);

  if (!can("comm.view") && !can("comm.viewOwn")) return <PermissionDenied action="view the inbox" role={roleLabels[role]} backHref="/communication" />;
  const canMessage = can("comm.message");

  const selected = selectedId ? db.conversations.find((c) => c.id === selectedId) : undefined;
  const messages = selected ? db.messages.filter((m) => m.conversationId === selected.id).sort((a, b) => a.sentAt.localeCompare(b.sentAt)) : [];
  const counterpart = selected ? participant(selected.counterpartId) : undefined;
  const student = selected?.studentId ? db.students.find((s) => s.id === selected.studentId) : undefined;

  function openConversation(id: string) {
    setSelectedId(id);
    markConversationRead(id);
    force((n) => n + 1);
  }

  function send() {
    if (!selected || !draft.trim()) return;
    sendMessage(selected.id, draft, { internal: internalMode });
    setDraft("");
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center justify-between gap-sm">
        <div className={cn(selectedId && "hidden md:block")}>
          <h1 className="text-lg font-semibold text-foreground">Inbox</h1>
          <p className="text-xs text-muted-foreground">Unified school messaging</p>
        </div>
        {selectedId && (
          <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setSelectedId(null)}>
            <ArrowLeft className="size-4" /> Back
          </Button>
        )}
      </div>

      <div className="grid gap-md md:grid-cols-[300px_minmax(0,1fr)] lg:grid-cols-[180px_320px_minmax(0,1fr)]">
        {/* Category nav — desktop only */}
        <nav className="hidden lg:flex lg:flex-col lg:gap-1" aria-label="Inbox categories">
          {categories.map((c) => (
            <button key={c.key} onClick={() => setCategory(c.key)} className={cn("flex items-center justify-between rounded-md px-sm py-2 text-sm font-medium", category === c.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-surface-secondary")}>
              {c.label}
            </button>
          ))}
        </nav>

        {/* Conversation list */}
        <div className={cn("flex flex-col gap-sm", selectedId && "hidden md:flex")}>
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations…" className="pl-8" aria-label="Search conversations" />
          </div>
          {/* Mobile/tablet category chips */}
          <div className="flex gap-1 overflow-x-auto lg:hidden">
            {categories.map((c) => (
              <button key={c.key} onClick={() => setCategory(c.key)} className={cn("shrink-0 rounded-pill px-3 py-1 text-xs font-medium", category === c.key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground")}>{c.label}</button>
            ))}
          </div>
          <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-1 overflow-y-auto md:max-h-[calc(100dvh-12rem)]">
            {conversations.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No conversations found.</p>
            ) : (
              conversations.map((c) => <ConversationRow key={c.id} conversation={c} name={participant(c.counterpartId)?.name ?? "Unknown"} color={participant(c.counterpartId)?.avatarColor} roleLabel={participantRoleLabels[participant(c.counterpartId)?.role ?? "parent"]} active={c.id === selectedId} onClick={() => openConversation(c.id)} />)
            )}
          </div>
        </div>

        {/* Conversation view */}
        <div className={cn("flex-col rounded-lg border border-border bg-surface", selectedId ? "flex" : "hidden md:flex")}>
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-sm p-2xl text-center">
              <Info className="size-6 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Select a conversation to read and reply.</p>
            </div>
          ) : (
            <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-12rem)]">
              {/* Header */}
              <div className="flex items-center justify-between gap-sm border-b border-border p-sm">
                <div className="flex min-w-0 items-center gap-sm">
                  <PersonAvatar name={counterpart?.name ?? "?"} color={counterpart?.avatarColor} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{counterpart?.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{participantRoleLabels[counterpart?.role ?? "parent"]} · {conversationCategoryLabels[selected.category]}</p>
                  </div>
                </div>
                <div className="flex items-center gap-xs">
                  {selected.priority !== "normal" && <Badge tone={selected.priority === "urgent" ? "error" : "warning"}>{selected.priority}</Badge>}
                  {can("comm.message") && selected.status === "open" && <Button size="sm" variant="ghost" onClick={() => { setConversationStatus(selected.id, "resolved"); force((n) => n + 1); }}>Resolve</Button>}
                </div>
              </div>

              {/* Student context strip */}
              {student && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-surface-secondary/40 px-sm py-2 text-xs">
                  <Link href={`/students/${student.id}`} className="font-medium text-primary hover:underline">{student.profile.firstName} {student.profile.lastName}</Link>
                  <Ctx label="Class" value={student.classId} />
                  <Ctx label="Today" value={student.attendance.todayStatus} />
                  <Ctx label="Homework" value={`${student.academics.recentHomework.filter((h) => h.status !== "submitted").length} pending`} />
                  <Ctx label="Fees" value={student.fees.overdueAmount > 0 ? `${formatCurrency(student.fees.overdueAmount)} due` : "clear"} />
                  {student.academics.upcomingExams[0] && <Ctx label="Next exam" value={`${student.academics.upcomingExams[0].subject}`} />}
                </div>
              )}

              {/* Messages */}
              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-sm">
                {messages.map((m) => (
                  <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                    <div className={cn("max-w-[80%] rounded-lg px-sm py-2 text-sm", m.internal ? "border border-dashed border-warning/50 bg-warning/8 text-foreground" : m.fromMe ? "bg-primary text-primary-foreground" : "border border-border bg-surface-secondary text-foreground")}>
                      {m.internal && <p className="mb-0.5 flex items-center gap-1 text-[11px] font-semibold text-warning"><Star className="size-3" /> Internal note (private)</p>}
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      {m.attachments.map((a) => (
                        <span key={a.id} className="mt-1 flex items-center gap-1 rounded-md bg-black/10 px-2 py-1 text-xs"><FileText className="size-3" /> {a.name}</span>
                      ))}
                      <span className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", m.fromMe && !m.internal ? "text-primary-foreground/70" : "text-muted-foreground")}>
                        {timeAgo(m.sentAt)}
                        {m.fromMe && !m.internal && (m.delivery === "read" ? <CheckCheck className="size-3" /> : m.delivery === "failed" ? <TriangleAlert className="size-3 text-error" /> : m.delivery === "delivered" ? <CheckCheck className="size-3 opacity-60" /> : <Check className="size-3" />)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Composer */}
              {canMessage ? (
                <div className="border-t border-border p-sm">
                  {internalMode && <p className="mb-1 text-xs font-medium text-warning">Internal note — visible to staff only</p>}
                  <div className="flex items-end gap-xs">
                    <div className="flex gap-0.5">
                      <button type="button" className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-secondary" aria-label="Attach file (demo)" title="Attachment — demo"><Paperclip className="size-4" /></button>
                      <button type="button" className="flex size-9 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-secondary" aria-label="Emoji (demo)" title="Emoji — demo"><Smile className="size-4" /></button>
                      <button type="button" onClick={() => setInternalMode((v) => !v)} className={cn("flex size-9 items-center justify-center rounded-md", internalMode ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-surface-secondary")} aria-label="Toggle internal note" title="Internal note"><Star className="size-4" /></button>
                    </div>
                    <Input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())} placeholder={internalMode ? "Add a private internal note…" : "Type a message…"} aria-label="Message" />
                    <Button size="icon" onClick={send} disabled={!draft.trim()} aria-label="Send"><Send className="size-4" /></Button>
                  </div>
                  <p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock className="size-3" /> Schedule send is a demo action in this build.</p>
                </div>
              ) : (
                <div className="border-t border-border p-sm text-center text-xs text-muted-foreground">You have read-only access to this conversation.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ConversationRow({ conversation, name, color, roleLabel, active, onClick }: { conversation: Conversation; name: string; color?: string; roleLabel: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex w-full items-start gap-sm rounded-lg border p-sm text-left transition-colors", active ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40")}>
      <PersonAvatar name={name} color={color} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <p className={cn("truncate text-sm", conversation.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground")}>{name}</p>
          <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(conversation.lastMessageAt)}</span>
        </div>
        <p className="truncate text-xs text-muted-foreground">{conversation.subject}</p>
        <div className="mt-0.5 flex items-center gap-1">
          <p className={cn("truncate text-xs", conversation.unreadCount > 0 ? "text-foreground" : "text-muted-foreground")}>{conversation.lastMessagePreview}</p>
        </div>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {conversation.unreadCount > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{conversation.unreadCount}</span>}
        {conversation.priority === "urgent" && <TriangleAlert className="size-3 text-error" aria-label="Urgent" />}
        {conversation.hasAttachment && <Paperclip className="size-3 text-muted-foreground" aria-label="Has attachment" />}
        <span className="sr-only">{roleLabel}</span>
      </div>
    </button>
  );
}

function Ctx({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-pill bg-surface px-2 py-0.5 text-[11px]">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium capitalize text-foreground">{value}</span>
    </span>
  );
}
