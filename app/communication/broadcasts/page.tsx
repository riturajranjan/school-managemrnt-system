"use client";

import { useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Radio,
  Send,
  Users,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ChannelChips,
  ChannelLegend,
} from "@/components/communication/channel-chips";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createBroadcast } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import {
  channelLabels,
  type AnnouncementAudience,
  type CommChannel,
} from "@/lib/types/communication";
import { formatDate } from "@/lib/utils";

const steps = [
  "Audience",
  "Message",
  "Channels",
  "Schedule",
  "Review",
] as const;

export default function BroadcastCentrePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [composing, setComposing] = useState(false);
  const [step, setStep] = useState(0);
  const [audience, setAudience] = useState<AnnouncementAudience>("parents");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [channels, setChannels] = useState<CommChannel[]>(["in-app"]);
  const [scheduleDate, setScheduleDate] = useState("");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [, force] = useState(0);

  if (!can("comm.view"))
    return (
      <PermissionDenied
        action="view broadcasts"
        role={roleLabels[role]}
        backHref="/communication"
      />
    );
  const canBroadcast = can("comm.broadcast");

  const estimate = (() => {
    switch (audience) {
      case "everyone":
        return db.students.length + db.employees.length;
      case "students":
      case "parents":
        return db.students.length;
      case "teachers":
        return db.employees.filter((e) => e.isTeaching).length;
      case "staff":
        return db.employees.length;
      default:
        return 120;
    }
  })();

  function toggleChannel(ch: CommChannel) {
    setChannels((p) =>
      p.includes(ch) ? p.filter((c) => c !== ch) : [...p, ch],
    );
  }
  function reset() {
    setComposing(false);
    setStep(0);
    setTitle("");
    setMessage("");
    setChannels(["in-app"]);
    setScheduleDate("");
  }
  function doSend(send: boolean) {
    createBroadcast(
      {
        title,
        message,
        audience,
        channels,
        estimatedRecipients: estimate,
        scheduledAt: scheduleDate || undefined,
      },
      send,
    );
    reset();
    force((n) => n + 1);
  }

  if (composing) {
    return (
      <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
        <div className="flex items-center justify-between gap-sm">
          <h1 className="text-lg font-semibold text-foreground">
            New broadcast
          </h1>
          <Button size="sm" variant="ghost" onClick={reset}>
            Cancel
          </Button>
        </div>
        <ol className="flex flex-wrap items-center gap-1 text-xs">
          {steps.map((s, i) => (
            <li key={s} className="flex items-center gap-1">
              <span
                className={`flex items-center gap-1 rounded-pill px-2 py-1 font-medium ${i === step ? "bg-primary text-primary-foreground" : i < step ? "bg-primary/10 text-primary" : "bg-surface-secondary text-muted-foreground"}`}>
                {i < step ? <Check className="size-3" /> : i + 1} {s}
              </span>
              {i < steps.length - 1 && (
                <ChevronRight className="size-3 text-muted-foreground" />
              )}
            </li>
          ))}
        </ol>

        <div className="rounded-lg border border-border bg-surface p-md">
          {step === 0 && (
            <div className="flex flex-col gap-sm">
              <p className="text-sm font-medium text-foreground">
                Who should receive this?
              </p>
              <div className="grid grid-cols-2 gap-sm sm:grid-cols-3">
                {(
                  [
                    "everyone",
                    "students",
                    "parents",
                    "teachers",
                    "staff",
                  ] as AnnouncementAudience[]
                ).map((a) => (
                  <button
                    key={a}
                    onClick={() => setAudience(a)}
                    className={`rounded-md border p-sm text-sm capitalize ${audience === a ? "border-primary bg-primary/5 text-primary" : "border-border text-foreground"}`}>
                    {a}
                  </button>
                ))}
              </div>
              <p className="flex items-center gap-1 rounded-md bg-surface-secondary/50 p-sm text-sm text-foreground">
                <Users className="size-4 text-primary" /> Estimated recipients:{" "}
                <span className="font-semibold">
                  {estimate.toLocaleString("en-IN")}
                </span>
              </p>
            </div>
          )}
          {step === 1 && (
            <div className="flex flex-col gap-sm">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Broadcast title"
                aria-label="Title"
              />
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="rounded-md border border-border bg-surface px-sm py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Message body…"
              />
            </div>
          )}
          {step === 2 && (
            <div className="flex flex-col gap-sm">
              <div className="flex flex-wrap gap-1">
                {(Object.keys(channelLabels) as CommChannel[]).map((ch) => (
                  <button
                    key={ch}
                    onClick={() => toggleChannel(ch)}
                    className={`rounded-pill px-3 py-1 text-xs font-medium ${channels.includes(ch) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>
                    {channelLabels[ch]}
                  </button>
                ))}
              </div>
              <ChannelLegend />
            </div>
          )}
          {step === 3 && (
            <div className="flex flex-col gap-sm">
              <p className="text-sm text-muted-foreground">
                Leave empty to send immediately, or pick a date to schedule.
              </p>
              <Input
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                className="w-48"
                aria-label="Schedule date"
              />
            </div>
          )}
          {step === 4 && (
            <div className="flex flex-col gap-sm text-sm">
              <Row
                label="Audience"
                value={`${audience} · ~${estimate.toLocaleString("en-IN")} recipients`}
              />
              <Row label="Title" value={title || "—"} />
              <Row label="Message" value={message || "—"} />
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Channels</span>
                <ChannelChips channels={channels} />
              </div>
              <Row
                label="When"
                value={
                  scheduleDate
                    ? `Scheduled ${scheduleDate}`
                    : "Send immediately"
                }
              />
            </div>
          )}
        </div>

        <div className="flex justify-between gap-sm">
          {step > 0 ? (
            <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
              <ChevronLeft className="size-4" /> Back
            </Button>
          ) : (
            <span />
          )}
          {step < steps.length - 1 ? (
            <Button
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 1 && !title.trim()}>
              Next <ChevronRight className="size-4" />
            </Button>
          ) : scheduleDate ? (
            <Button onClick={() => doSend(false)}>Schedule broadcast</Button>
          ) : (
            <Button onClick={() => setConfirmOpen(true)}>
              <Send className="size-4" /> Send now
            </Button>
          )}
        </div>

        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Send broadcast?"
          description={`This will send to ~${estimate.toLocaleString("en-IN")} recipients. In-app is live; other channels are demo only.`}
          confirmLabel="Send"
          onConfirm={() => {
            setConfirmOpen(false);
            doSend(true);
          }}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Broadcast centre
          </h1>
          <p className="text-xs text-muted-foreground">
            {db.commBroadcasts.length} broadcasts
          </p>
        </div>
        {canBroadcast && (
          <Button size="sm" onClick={() => setComposing(true)}>
            <Radio className="size-3.5" /> New broadcast
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-sm">
        {db.commBroadcasts.map((b) => (
          <div
            key={b.id}
            className="rounded-lg border border-border bg-surface p-md">
            <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-semibold text-foreground">{b.title}</p>
              <Badge
                tone={
                  b.status === "sent"
                    ? "success"
                    : b.status === "scheduled"
                      ? "info"
                      : b.status === "failed"
                        ? "error"
                        : "neutral"
                }>
                {b.status}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">{b.message}</p>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <ChannelChips channels={b.channels} />
              <span className="text-xs text-muted-foreground">
                {b.status === "sent"
                  ? `${b.deliveredCount.toLocaleString("en-IN")} delivered${b.failedCount > 0 ? `, ${b.failedCount} failed` : ""}`
                  : b.status === "scheduled"
                    ? `Scheduled ${formatDate(b.scheduledAt!)}`
                    : `~${b.estimatedRecipients.toLocaleString("en-IN")} recipients`}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-sm">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 text-right font-medium text-foreground">
        {value}
      </span>
    </div>
  );
}
