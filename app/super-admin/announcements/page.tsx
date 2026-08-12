"use client";

// Real platform announcements (Super Admin SA-4N). Reads GET /api/super-admin/
// announcements and manages the DRAFT → PUBLISHED → ARCHIVED lifecycle. Shown
// in-app only — no email/SMS/push delivery, so no delivery metrics. No mock store.
import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  archiveAnnouncementRequest,
  createAnnouncementRequest,
  publishAnnouncementRequest,
  usePlatformAnnouncements,
} from "@/lib/hooks/api/use-platform-system";
import { formatDate } from "@/lib/utils";
import type { StatusTone } from "@/lib/types/common";

const statusTone: Record<string, StatusTone> = { draft: "neutral", published: "success", archived: "warning" };
const AUDIENCES = [
  { value: "all-schools", label: "All schools" },
  { value: "all-platform-users", label: "All platform users" },
  { value: "platform-admins", label: "Platform admins" },
] as const;

export default function AnnouncementsPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.announcements.manage");
  const { data, loading, error, reload } = usePlatformAnnouncements();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState("product-update");
  const [audience, setAudience] = useState<string>("all-schools");
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function create() {
    setBusy("create"); setActionError(null);
    const res = await createAnnouncementRequest({ title: title.trim(), body: body.trim(), category, audience });
    setBusy(null);
    if (!res.success) setActionError(res.error.message);
    else { setTitle(""); setBody(""); setOpen(false); reload(); }
  }
  async function act(id: string, fn: () => Promise<{ success: boolean; error?: { message: string } }>) {
    setBusy(id); setActionError(null);
    const res = await fn();
    setBusy(null);
    if (!res.success) setActionError(res.error?.message ?? "Failed"); else reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Megaphone className="size-5 text-primary" /> Platform announcements</h1><p className="text-xs text-muted-foreground">Shown in-app only · no email/SMS/push delivery</p></div>
        {canManage && <Button size="sm" onClick={() => setOpen((o) => !o)}><Plus className="size-3.5" /> New</Button>}
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}

      {open && canManage && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div><Label htmlFor="a-title">Title</Label><Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-sm">
            <div><Label htmlFor="a-cat">Category</Label><Input id="a-cat" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
            <div><Label>Audience</Label><Select value={audience} onValueChange={setAudience}><SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger><SelectContent>{AUDIENCES.map((a) => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label htmlFor="a-body">Message</Label><Textarea id="a-body" rows={2} value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} /></div>
          <div className="flex justify-end gap-xs"><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" onClick={() => void create()} disabled={busy === "create" || !title.trim() || !body.trim()}>Create draft</Button></div>
        </div>
      )}

      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading announcements…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load announcements: {error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-xs">
          {data.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No announcements yet.</p>}
          {data.map((a) => (
            <div key={a.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm text-sm sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2"><p className="truncate font-medium text-foreground">{a.title}</p>{a.category && <Badge tone="info">{a.category}</Badge>}</div>
                <p className="truncate text-xs text-muted-foreground">{a.audience.replace(/-/g, " ")}{a.publishedAt ? ` · published ${formatDate(a.publishedAt)}` : ""}</p>
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                {canManage && a.status === "draft" && <Button size="sm" disabled={busy === a.id} onClick={() => void act(a.id, () => publishAnnouncementRequest(a.id))}>Publish</Button>}
                {canManage && a.status !== "archived" && <Button size="sm" variant="ghost" disabled={busy === a.id} onClick={() => void act(a.id, () => archiveAnnouncementRequest(a.id))}>Archive</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
