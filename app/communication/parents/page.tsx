"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CalendarPlus, CheckCircle2, MessageSquare, Search, StickyNote } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PersonAvatar } from "@/components/communication/person-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setConversationStatus } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { conversationCategoryLabels, type ConversationCategory } from "@/lib/types/communication";
import { formatDate, timeAgo } from "@/lib/utils";

export default function ParentTeacherPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("all");
  const [status, setStatus] = useState("all");
  const [, force] = useState(0);

  const participant = (id: string) => db.conversationParticipants.find((p) => p.id === id);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.conversations
      .filter((c) => participant(c.counterpartId)?.role === "parent")
      .filter((c) => (cat === "all" ? true : c.category === cat))
      .filter((c) => (status === "all" ? true : c.status === status))
      .filter((c) => (q ? (participant(c.counterpartId)?.name ?? "").toLowerCase().includes(q) : true))
      .sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db.conversations, db.conversationParticipants, query, cat, status]);

  if (!can("comm.view")) return <PermissionDenied action="view parent–teacher communication" role={roleLabels[role]} backHref="/communication" />;
  const canMessage = can("comm.message");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Parent–Teacher communication</h1>
        <p className="text-xs text-muted-foreground">{rows.length} parent conversations</p>
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search parent…" className="pl-8" aria-label="Search parents" />
        </div>
        <div className="flex gap-xs">
          <Select value={cat} onValueChange={setCat}>
            <SelectTrigger className="w-36" aria-label="Category"><SelectValue placeholder="Category" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All topics</SelectItem>{(Object.keys(conversationCategoryLabels) as ConversationCategory[]).map((c) => <SelectItem key={c} value={c}>{conversationCategoryLabels[c]}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-32" aria-label="Status"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent><SelectItem value="all">All</SelectItem><SelectItem value="open">Open</SelectItem><SelectItem value="resolved">Resolved</SelectItem></SelectContent>
          </Select>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <MessageSquare className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No parent conversations match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {rows.map((c) => {
            const person = participant(c.counterpartId);
            const student = c.studentId ? db.students.find((s) => s.id === c.studentId) : undefined;
            return (
              <div key={c.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="flex min-w-0 items-center gap-sm">
                    <PersonAvatar name={person?.name ?? "?"} color={person?.avatarColor} size="md" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{person?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">Parent{student ? ` of ${student.profile.firstName} · ${student.classId}` : ""}</p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge tone="neutral">{conversationCategoryLabels[c.category]}</Badge>
                    {c.status === "open" && <Badge tone={c.priority === "urgent" ? "error" : "info"}>{c.status}</Badge>}
                  </div>
                </div>
                <p className="truncate text-xs text-muted-foreground">Last contact {timeAgo(c.lastMessageAt)}{c.nextFollowUpAt ? ` · follow-up ${formatDate(c.nextFollowUpAt)}` : ""}</p>
                {canMessage && (
                  <div className="flex flex-wrap gap-xs">
                    <Button asChild size="sm" variant="outline"><Link href="/communication/inbox"><MessageSquare className="size-3.5" /> Message</Link></Button>
                    <Button asChild size="sm" variant="ghost"><Link href="/front-desk/appointments"><CalendarPlus className="size-3.5" /> Request meeting</Link></Button>
                    <Button size="sm" variant="ghost" title="Internal note"><StickyNote className="size-3.5" /> Note</Button>
                    {c.status === "open" && <Button size="sm" variant="ghost" onClick={() => { setConversationStatus(c.id, "resolved"); force((n) => n + 1); }}><CheckCircle2 className="size-3.5" /> Resolve</Button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
