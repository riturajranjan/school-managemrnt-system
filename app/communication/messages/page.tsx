"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MessageSquare, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/communication/person-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { participantRoleLabels } from "@/lib/types/communication";
import { timeAgo } from "@/lib/utils";

export default function DirectMessagesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.conversations
      .filter((c) => c.status !== "archived")
      .map((c) => ({ conversation: c, person: db.conversationParticipants.find((p) => p.id === c.counterpartId) }))
      .filter((r) => (q ? (r.person?.name ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => b.conversation.lastMessageAt.localeCompare(a.conversation.lastMessageAt));
  }, [db.conversations, db.conversationParticipants, query]);

  if (!can("comm.view") && !can("comm.viewOwn")) return <PermissionDenied action="view messages" role={roleLabels[role]} backHref="/communication" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Direct messages</h1>
        <p className="text-xs text-muted-foreground">Your recent 1:1 conversations · open in the unified inbox</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people…" className="pl-8" aria-label="Search people" />
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <MessageSquare className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No conversations yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map(({ conversation, person }) => (
            <Link key={conversation.id} href="/communication/inbox" className="flex items-center gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
              <PersonAvatar name={person?.name ?? "?"} color={person?.avatarColor} size="md" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-foreground">{person?.name}</p>
                  <span className="text-[10px] text-muted-foreground">{timeAgo(conversation.lastMessageAt)}</span>
                </div>
                <p className="truncate text-xs text-muted-foreground">{conversation.lastMessagePreview}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                {conversation.unreadCount > 0 && <span className="flex size-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{conversation.unreadCount}</span>}
                <Badge tone="neutral">{participantRoleLabels[person?.role ?? "parent"]}</Badge>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
