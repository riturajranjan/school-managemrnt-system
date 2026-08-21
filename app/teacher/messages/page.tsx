"use client";

// Messages (Phase 9K) — real PostgreSQL/API cutover. This route used to be a
// mock parent SMS/WhatsApp/Email broadcaster — that feature has no honest
// real backing (no Student/Guardian User account exists to message, and
// building an SMS/WhatsApp/email gateway is explicitly out of scope) and has
// been replaced with real staff-to-staff messaging: real Conversations/
// Messages between real Users, recipient directory, unread state, and
// Phase 9D notification integration. The caller's identity always comes
// from their real session — never a hardcoded demo teacher id.
import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MessageSquarePlus, Search, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/communication/person-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import {
  markConversationReadRequest,
  sendMessageRequest,
  startDirectConversationRequest,
  useConversations,
  useMessageHistory,
  useRecipients,
} from "@/lib/hooks/api/use-communication-api";
import { cn, timeAgo, formatDateTime } from "@/lib/utils";

function TeacherMessagesPageContent() {
  const searchParams = useSearchParams();
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: conversations, loading, error, reload } = useConversations();
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get("conversation"));
  const [composing, setComposing] = useState(false);
  const [recipientQuery, setRecipientQuery] = useState("");
  const { data: recipients } = useRecipients(recipientQuery);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [starting, setStarting] = useState(false);

  const history = useMessageHistory(selectedId);
  const selected = conversations.find((c) => c.id === selectedId);

  useEffect(() => {
    if (!selectedId) return;
    markConversationReadRequest(selectedId).then(() => reload());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  if (!capabilitiesLoading && !hasServerPermission("communication.send")) {
    return <PermissionDenied action="use messaging" role={roleLabels[role]} backHref="/" />;
  }

  async function openConversation(id: string) {
    setSelectedId(id);
    setComposing(false);
  }

  async function startConversation(recipientUserId: string) {
    setStarting(true);
    const res = await startDirectConversationRequest({ recipientUserId });
    setStarting(false);
    if (!res.success) return;
    setComposing(false);
    setRecipientQuery("");
    reload();
    setSelectedId(res.data.id);
  }

  async function send() {
    if (!selectedId || !draft.trim()) return;
    setSending(true);
    const body = draft.trim();
    const res = await sendMessageRequest(selectedId, body);
    setSending(false);
    if (!res.success) return;
    setDraft("");
    history.append(res.data);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className={cn(selectedId || composing ? "hidden md:block" : "")}>
        <h1 className="text-lg font-semibold text-foreground">Messages</h1>
        <p className="text-xs text-muted-foreground">Real-time conversations with school admins, principals and teachers</p>
      </div>

      <div className="grid gap-md md:grid-cols-[300px_minmax(0,1fr)]">
        {/* Conversation list */}
        <div className={cn("flex flex-col gap-sm", (selectedId || composing) && "hidden md:flex")}>
          <Button size="sm" onClick={() => { setComposing(true); setSelectedId(null); }}>
            <MessageSquarePlus className="size-3.5" /> New message
          </Button>

          {error ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">{error}</p>
          ) : loading && conversations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">Loading…</p>
          ) : conversations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No conversations yet.</p>
          ) : (
            <div className="flex max-h-[calc(100dvh-16rem)] flex-col gap-1 overflow-y-auto">
              {conversations.map((c) => (
                <button
                  key={c.id}
                  onClick={() => openConversation(c.id)}
                  className={cn("flex w-full items-start gap-sm rounded-lg border p-sm text-left transition-colors", c.id === selectedId ? "border-primary bg-primary/5" : "border-border bg-surface hover:border-primary/40")}
                >
                  <PersonAvatar name={c.title} size="md" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn("truncate text-sm", c.unreadCount > 0 ? "font-semibold text-foreground" : "font-medium text-foreground")}>{c.title}</p>
                      {c.lastMessage && <span className="shrink-0 text-[10px] text-muted-foreground">{timeAgo(c.lastMessage.createdAt)}</span>}
                    </div>
                    <p className={cn("truncate text-xs", c.unreadCount > 0 ? "text-foreground" : "text-muted-foreground")}>
                      {c.lastMessage ? `${c.lastMessage.fromMe ? "You: " : ""}${c.lastMessage.body}` : "No messages yet"}
                    </p>
                  </div>
                  {c.unreadCount > 0 && <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{c.unreadCount}</span>}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Thread / composer */}
        <div className={cn("flex-col rounded-lg border border-border bg-surface", (selectedId || composing) ? "flex" : "hidden md:flex")}>
          {composing ? (
            <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-12rem)]">
              <div className="flex items-center gap-sm border-b border-border p-sm">
                <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setComposing(false)}>
                  <ArrowLeft className="size-4" /> Back
                </Button>
                <p className="text-sm font-semibold text-foreground">New message</p>
              </div>
              <div className="p-sm">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={recipientQuery} onChange={(e) => setRecipientQuery(e.target.value)} placeholder="Search people…" className="pl-8" aria-label="Search recipients" autoFocus />
                </div>
              </div>
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-sm pb-sm">
                {recipients.length === 0 ? (
                  <p className="p-sm text-center text-sm text-muted-foreground">No eligible recipients found.</p>
                ) : (
                  recipients.map((r) => (
                    <button
                      key={r.userId}
                      disabled={starting}
                      onClick={() => startConversation(r.userId)}
                      className="flex items-center gap-sm rounded-md p-sm text-left hover:bg-surface-secondary/60 disabled:opacity-50"
                    >
                      <PersonAvatar name={r.displayName} size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">{r.displayName}</p>
                        {r.roleLabel && <p className="truncate text-xs text-muted-foreground">{r.roleLabel}</p>}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          ) : !selected ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-sm p-2xl text-center">
              <p className="text-sm text-muted-foreground">Select a conversation, or start a new one.</p>
            </div>
          ) : (
            <div className="flex h-[calc(100dvh-11rem)] flex-col md:h-[calc(100dvh-12rem)]">
              <div className="flex items-center gap-sm border-b border-border p-sm">
                <Button size="sm" variant="ghost" className="md:hidden" onClick={() => setSelectedId(null)}>
                  <ArrowLeft className="size-4" />
                </Button>
                <PersonAvatar name={selected.title} size="sm" />
                <p className="truncate text-sm font-semibold text-foreground">{selected.title}</p>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-sm">
                {history.hasMore && (
                  <Button size="sm" variant="ghost" className="self-center" disabled={history.loadingMore} onClick={history.loadMore}>
                    {history.loadingMore ? "Loading…" : "Load older messages"}
                  </Button>
                )}
                {history.loading ? (
                  <p className="py-md text-center text-sm text-muted-foreground">Loading…</p>
                ) : history.error ? (
                  <p className="py-md text-center text-sm text-muted-foreground">{history.error}</p>
                ) : history.items.length === 0 ? (
                  <p className="py-md text-center text-sm text-muted-foreground">No messages yet — say hello.</p>
                ) : (
                  history.items.map((m) => (
                    <div key={m.id} className={cn("flex", m.fromMe ? "justify-end" : "justify-start")}>
                      <div className={cn("max-w-[80%] rounded-lg px-sm py-2 text-sm", m.fromMe ? "bg-primary text-primary-foreground" : "border border-border bg-surface-secondary text-foreground")}>
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <span className={cn("mt-0.5 block text-right text-[10px]", m.fromMe ? "text-primary-foreground/70" : "text-muted-foreground")}>{formatDateTime(m.createdAt)}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="border-t border-border p-sm">
                <div className="flex items-end gap-xs">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), send())}
                    placeholder="Type a message…"
                    aria-label="Message"
                    disabled={sending}
                  />
                  <Button size="icon" onClick={send} disabled={!draft.trim() || sending} aria-label="Send">
                    <Send className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TeacherMessagesPage() {
  return (
    <Suspense fallback={<div className="h-40" />}>
      <TeacherMessagesPageContent />
    </Suspense>
  );
}
