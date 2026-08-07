"use client";

import Link from "next/link";
import { Bell, Radio, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChannelChips, ChannelLegend } from "@/components/communication/channel-chips";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roleLabels } from "@/lib/permissions/roles";
import type { CommChannel } from "@/lib/types/communication";

const defaultChannels: CommChannel[] = ["in-app", "push", "sms", "whatsapp", "email"];

export default function CommunicationSettingsPage() {
  const { can, role } = usePermissions();
  if (!can("comm.manageSettings") && !can("comm.view")) return <PermissionDenied action="view communication settings" role={roleLabels[role]} backHref="/communication" />;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Communication settings</h1>
        <p className="text-xs text-muted-foreground">Channel configuration and defaults</p>
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Radio className="size-4" /> Channels</h2>
        <ChannelChips channels={defaultChannels} className="mb-2" />
        <ChannelLegend />
        <p className="mt-2 rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
          SMS, WhatsApp, Email and Push integrations are not connected in this build. Sending on those channels is simulated — no real messages are dispatched.
        </p>
      </section>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Bell className="size-4" /> Notifications</h2>
        <p className="mb-2 text-sm text-muted-foreground">Per-module notification channels, quiet hours and digest frequency are managed in preferences.</p>
        <Button asChild size="sm" variant="outline"><Link href="/notifications/preferences"><Settings2 className="size-3.5" /> Notification preferences</Link></Button>
      </section>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Backend-ready</h2>
        <p className="text-sm text-muted-foreground">This module runs entirely on typed frontend state. Provider connections (SMS/WhatsApp/Email/Push), delivery webhooks and message persistence are designed here and wired to a backend in a later phase.</p>
      </section>
    </div>
  );
}
