"use client";

import { useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAnnouncements } from "@/lib/hooks/use-saas";
import { publishAnnouncement } from "@/lib/services/saas-service";
import { announcementTypeLabels, type AnnouncementType } from "@/lib/types/saas";
import { formatDate } from "@/lib/utils";

const typeTone = { "product-update": "info", maintenance: "warning", security: "error", billing: "neutral", policy: "neutral", "feature-release": "success" } as const;

export default function AnnouncementsPage() {
  const announcements = useAnnouncements();
  const [, force] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<AnnouncementType>("product-update");
  const [audience, setAudience] = useState("All schools");
  const [body, setBody] = useState("");

  const submit = () => { if (publishAnnouncement({ title, type, audience, body }).ok) { setTitle(""); setBody(""); setOpen(false); force((n) => n + 1); } };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Megaphone className="size-5 text-primary" /> Platform announcements</h1><p className="text-xs text-muted-foreground">{announcements.length} announcements · frontend simulation</p></div>
        <Button size="sm" onClick={() => setOpen((o) => !o)}><Plus className="size-3.5" /> New</Button>
      </div>

      {open && (
        <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <div><Label htmlFor="a-title">Title</Label><Input id="a-title" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-sm">
            <div><Label>Type</Label><Select value={type} onValueChange={(v) => setType(v as AnnouncementType)}><SelectTrigger aria-label="Type"><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(announcementTypeLabels) as AnnouncementType[]).map((t) => <SelectItem key={t} value={t}>{announcementTypeLabels[t]}</SelectItem>)}</SelectContent></Select></div>
            <div><Label>Audience</Label><Select value={audience} onValueChange={setAudience}><SelectTrigger aria-label="Audience"><SelectValue /></SelectTrigger><SelectContent>{["All schools", "Selected plans", "Selected schools", "Trial schools"].map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label htmlFor="a-body">Message</Label><Textarea id="a-body" rows={2} value={body} onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setBody(e.target.value)} /></div>
          <div className="flex justify-end gap-xs"><Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button><Button size="sm" onClick={submit} disabled={!title.trim()}>Publish (simulation)</Button></div>
        </div>
      )}

      <div className="flex flex-col gap-xs">
        {announcements.map((a) => (
          <div key={a.id} className="flex items-start justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
            <div className="min-w-0"><div className="flex items-center gap-2"><p className="truncate font-medium text-foreground">{a.title}</p><Badge tone={typeTone[a.type]}>{announcementTypeLabels[a.type]}</Badge></div><p className="truncate text-xs text-muted-foreground">{a.audience} · {formatDate(a.publishedAt)}</p><p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p></div>
            <Badge tone={a.status === "published" ? "success" : a.status === "scheduled" ? "info" : "neutral"}>{a.status}</Badge>
          </div>
        ))}
      </div>
    </div>
  );
}
