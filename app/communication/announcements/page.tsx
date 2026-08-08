"use client";

import { useState } from "react";
import { Bell, Megaphone, Plus, Smartphone, Mail, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  ChannelChips,
  ChannelLegend,
} from "@/components/communication/channel-chips";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import {
  createAnnouncement,
  setAnnouncementStatus,
} from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import {
  announcementCategoryLabels,
  announcementStatusTone,
  channelLabels,
  type AnnouncementAudience,
  type AnnouncementCategory,
  type AnnouncementPriority,
  type CommChannel,
} from "@/lib/types/communication";
import { formatDate } from "@/lib/utils";

const previewModes = [
  { key: "parent", label: "Parent app", icon: Smartphone },
  { key: "push", label: "Push", icon: Bell },
  { key: "email", label: "Email", icon: Mail },
] as const;

export default function AnnouncementsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [composing, setComposing] = useState(false);
  const [, force] = useState(0);

  // Composer state
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] =
    useState<AnnouncementCategory>("school-event");
  const [audience, setAudience] = useState<AnnouncementAudience>("parents");
  const [priority, setPriority] = useState<AnnouncementPriority>("normal");
  const [ackRequired, setAckRequired] = useState(false);
  const [channels, setChannels] = useState<CommChannel[]>(["in-app", "push"]);
  const [preview, setPreview] =
    useState<(typeof previewModes)[number]["key"]>("parent");

  if (!can("comm.view"))
    return (
      <PermissionDenied
        action="view announcements"
        role={roleLabels[role]}
        backHref="/communication"
      />
    );
  const canManage = can("comm.manageAnnouncements");

  function toggleChannel(ch: CommChannel) {
    setChannels((prev) =>
      prev.includes(ch) ? prev.filter((c) => c !== ch) : [...prev, ch],
    );
  }

  function publish(scheduled: boolean) {
    if (!title.trim()) return;
    createAnnouncement({
      title: title.trim(),
      body: body.trim(),
      category,
      audience,
      priority,
      channels,
      status: scheduled ? "scheduled" : "published",
      acknowledgementRequired: ackRequired,
      hasAttachment: false,
      publishAt: new Date().toISOString(),
      createdBy: roleLabels[role],
    });
    setComposing(false);
    setTitle("");
    setBody("");
    force((n) => n + 1);
  }

  if (composing) {
    return (
      <div className="flex flex-col gap-md pb-20 sm:pb-0">
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-lg font-semibold text-foreground">
            New announcement
          </h1>
          <Button size="sm" variant="ghost" onClick={() => setComposing(false)}>
            Cancel
          </Button>
        </div>
        <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
          {/* Editor */}
          <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="atitle">Title</Label>
              <Input
                id="atitle"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Annual Sports Day"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="abody">Message</Label>
              <textarea
                id="abody"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="rounded-md border border-border bg-surface px-sm py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Write your announcement…"
              />
            </div>
            <div className="grid grid-cols-2 gap-md">
              <div className="flex flex-col gap-1.5">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => setCategory(v as AnnouncementCategory)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(
                        announcementCategoryLabels,
                      ) as AnnouncementCategory[]
                    ).map((c) => (
                      <SelectItem key={c} value={c}>
                        {announcementCategoryLabels[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1.5">
                <Label>Audience</Label>
                <Select
                  value={audience}
                  onValueChange={(v) => setAudience(v as AnnouncementAudience)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      [
                        "everyone",
                        "students",
                        "parents",
                        "teachers",
                        "staff",
                        "class",
                        "department",
                      ] as AnnouncementAudience[]
                    ).map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Priority</Label>
              <Select
                value={priority}
                onValueChange={(v) => setPriority(v as AnnouncementPriority)}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(
                    [
                      "normal",
                      "important",
                      "critical",
                    ] as AnnouncementPriority[]
                  ).map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Channels</Label>
              <div className="flex flex-wrap gap-1">
                {(Object.keys(channelLabels) as CommChannel[]).map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`rounded-pill px-3 py-1 text-xs font-medium ${channels.includes(ch) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                    {channelLabels[ch]}
                  </button>
                ))}
              </div>
              <ChannelLegend />
            </div>
            <label className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
              <span className="text-sm text-foreground">
                Require acknowledgement
              </span>
              <Switch checked={ackRequired} onCheckedChange={setAckRequired} />
            </label>
          </div>

          {/* Live preview */}
          <div className="flex flex-col gap-sm">
            <div className="flex gap-1">
              {previewModes.map((m) => (
                <button
                  key={m.key}
                  onClick={() => setPreview(m.key)}
                  className={`flex items-center gap-1 rounded-pill px-3 py-1 text-xs font-medium ${preview === m.key ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                  <m.icon className="size-3.5" /> {m.label}
                </button>
              ))}
            </div>
            <div className="rounded-lg border border-border bg-surface-secondary/40 p-md">
              {preview === "push" ? (
                <div className="mx-auto  rounded-xl border border-border bg-surface p-sm shadow-floating">
                  <div className="flex items-center gap-2">
                    <span className="flex size-7 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Megaphone className="size-3.5" />
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      Novyra Campus
                    </span>
                    <span className="ml-auto text-[10px] text-muted-foreground">
                      now
                    </span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-foreground">
                    {title || "Announcement title"}
                  </p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {body || "Your message preview appears here."}
                  </p>
                </div>
              ) : preview === "email" ? (
                <div className="mx-auto  rounded-lg border border-border bg-background p-md">
                  <p className="text-xs text-muted-foreground">
                    From: Novyra International School
                  </p>
                  <p className="text-xs text-muted-foreground">
                    To: {audience}
                  </p>
                  <hr className="my-2 border-border" />
                  <p className="text-base font-semibold text-foreground">
                    {title || "Announcement title"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                    {body || "Your message preview appears here."}
                  </p>
                </div>
              ) : (
                <div className="mx-auto  rounded-2xl border border-border bg-surface p-md shadow-floating">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Megaphone className="size-4" />
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">
                        School announcement
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {announcementCategoryLabels[category]}
                      </p>
                    </div>
                    {priority !== "normal" && (
                      <Badge
                        tone={priority === "critical" ? "error" : "warning"}
                        className="ml-auto">
                        {priority}
                      </Badge>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    {title || "Announcement title"}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">
                    {body || "Your message preview appears here."}
                  </p>
                  {ackRequired && (
                    <Button size="sm" className="mt-2 w-full">
                      <Check className="size-3.5" /> Acknowledge
                    </Button>
                  )}
                </div>
              )}
            </div>
            <div className="flex justify-end gap-xs">
              <Button variant="outline" onClick={() => publish(true)}>
                Schedule
              </Button>
              <Button onClick={() => publish(false)}>Publish now</Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Announcements
          </h1>
          <p className="text-xs text-muted-foreground">
            {db.commAnnouncements.length} announcements
          </p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setComposing(true)}>
            <Plus className="size-3.5" /> New announcement
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-sm">
        {db.commAnnouncements.map((a) => {
          const seenPct =
            a.sentCount > 0 ? Math.round((a.seenCount / a.sentCount) * 100) : 0;
          return (
            <div
              key={a.id}
              className="surface-3d rounded-lg border border-border bg-surface p-md">
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Megaphone className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground">
                      {a.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {announcementCategoryLabels[a.category]} · {a.audience} ·{" "}
                      {formatDate(a.publishAt)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-xs">
                  {a.priority !== "normal" && (
                    <Badge
                      tone={a.priority === "critical" ? "error" : "warning"}>
                      {a.priority}
                    </Badge>
                  )}
                  <Badge tone={announcementStatusTone[a.status]}>
                    {a.status}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{a.body}</p>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                <ChannelChips channels={a.channels} />
                {a.status === "published" && (
                  <span className="text-xs text-muted-foreground">
                    {a.seenCount}/{a.sentCount} seen ({seenPct}%)
                    {a.acknowledgementRequired
                      ? ` · ${a.acknowledgedCount} acknowledged`
                      : ""}
                  </span>
                )}
              </div>
              {canManage && a.status === "draft" && (
                <div className="mt-2 flex gap-xs">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setAnnouncementStatus(a.id, "published");
                      force((n) => n + 1);
                    }}>
                    Publish
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
