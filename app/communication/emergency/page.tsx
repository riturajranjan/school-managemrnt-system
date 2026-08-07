"use client";

import { useState } from "react";
import { ShieldAlert, Siren } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ChannelChips, ChannelLegend } from "@/components/communication/channel-chips";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createAnnouncement } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { channelLabels, type AnnouncementAudience, type CommChannel } from "@/lib/types/communication";

const scenarios = ["School closure", "Weather alert", "Transport emergency", "Security issue", "Medical emergency", "Route disruption", "Natural disaster", "Custom"] as const;

export default function EmergencyPage() {
  const { can, role } = usePermissions();
  const [scenario, setScenario] = useState<string>(scenarios[0]);
  const [audience, setAudience] = useState<AnnouncementAudience>("everyone");
  const [message, setMessage] = useState("");
  const [instructions, setInstructions] = useState("");
  const [channels, setChannels] = useState<CommChannel[]>(["in-app", "push", "sms"]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sent, setSent] = useState(false);

  if (!can("comm.emergency")) return <PermissionDenied action="send emergency communications" role={roleLabels[role]} backHref="/communication" />;

  function toggleChannel(ch: CommChannel) { setChannels((p) => (p.includes(ch) ? p.filter((c) => c !== ch) : [...p, ch])); }
  function doSend() {
    createAnnouncement({ title: `EMERGENCY: ${scenario}`, body: `${message}${instructions ? `\n\nInstructions: ${instructions}` : ""}`, category: "emergency-notice", audience, priority: "critical", channels, status: "published", acknowledgementRequired: true, hasAttachment: false, publishAt: new Date().toISOString(), createdBy: roleLabels[role] });
    setConfirmOpen(false);
    setSent(true);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm rounded-lg border border-error/30 bg-error/5 p-md">
        <span className="flex size-10 items-center justify-center rounded-md bg-error/10 text-error"><ShieldAlert className="size-5" /></span>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Emergency communication</h1>
          <p className="text-xs text-muted-foreground">High-priority alerts require confirmation before sending. Use responsibly.</p>
        </div>
      </div>

      {sent && (
        <div className="rounded-md border border-success/30 bg-success/8 p-sm text-sm text-success" role="status">
          Emergency notice published in-app. Demo channels (SMS/WhatsApp/Push) are not connected in this build. A follow-up message can be sent from Announcements.
        </div>
      )}

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label>Incident type</Label>
            <Select value={scenario} onValueChange={setScenario}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{scenarios.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Audience</Label>
            <Select value={audience} onValueChange={(v) => setAudience(v as AnnouncementAudience)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(["everyone", "parents", "staff", "teachers", "students"] as AnnouncementAudience[]).map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="emsg">Message</Label><textarea id="emsg" value={message} onChange={(e) => setMessage(e.target.value)} rows={3} className="rounded-md border border-border bg-surface px-sm py-2 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring" placeholder="Clear, factual description of the situation…" /></div>
        <div className="flex flex-col gap-1.5"><Label htmlFor="einstr">Instructions</Label><Input id="einstr" value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. Please collect your child from the main gate." /></div>
        <div className="flex flex-col gap-1.5">
          <Label>Channels</Label>
          <div className="flex flex-wrap gap-1">
            {(Object.keys(channelLabels) as CommChannel[]).map((ch) => (
              <button key={ch} type="button" onClick={() => toggleChannel(ch)} className={`rounded-pill px-3 py-1 text-xs font-medium ${channels.includes(ch) ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground"}`}>{channelLabels[ch]}</button>
            ))}
          </div>
          <ChannelChips channels={channels} className="mt-1" />
          <ChannelLegend />
        </div>
        <div className="flex justify-end">
          <Button variant="destructive" onClick={() => setConfirmOpen(true)} disabled={!message.trim()}><Siren className="size-4" /> Review & send alert</Button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Send emergency alert: ${scenario}?`}
        description="This publishes a critical, acknowledgement-required notice immediately. In-app is live; external channels are demo only in this build. Confirm to proceed."
        confirmLabel="Send emergency alert"
        destructive
        onConfirm={doSend}
      />
    </div>
  );
}
