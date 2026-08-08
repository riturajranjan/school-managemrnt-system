"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useNotificationSettings } from "@/lib/hooks/use-admin";
import { toggleNotification } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import { channelRequiresIntegration, notificationChannelLabels, type NotificationChannel } from "@/lib/types/admin";

const CHANNELS: NotificationChannel[] = ["in-app", "push", "email", "sms", "whatsapp"];

export default function NotificationSettingsPage() {
  const { role } = usePermissions();
  const settings = useNotificationSettings();
  const [, force] = useState(0);

  const canManage = role === "super-admin" || role === "administrator" || role === "communication-admin";
  if (!canManage) return <PermissionDenied action="manage notifications" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Mail className="size-5 text-primary" /> Notification settings</h1><p className="text-xs text-muted-foreground">Per-module channel preferences</p></div>

      <div className="flex flex-wrap gap-2 text-xs">
        {CHANNELS.map((c) => <span key={c} className="flex items-center gap-1 rounded-pill bg-surface-secondary px-2 py-0.5 text-muted-foreground">{notificationChannelLabels[c]}{channelRequiresIntegration[c] && <Badge tone="warning">Integration required</Badge>}</span>)}
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/60 text-xs text-muted-foreground"><th className="px-sm py-2 text-left">Module</th>{CHANNELS.map((c) => <th key={c} className="px-sm py-2 text-center">{notificationChannelLabels[c]}</th>)}</tr></thead>
          <tbody>
            {settings.map((s) => (
              <tr key={s.module} className="border-b border-border/60">
                <th scope="row" className="px-sm py-2 text-left font-medium text-foreground">{s.module}</th>
                {CHANNELS.map((c) => (
                  <td key={c} className="px-sm py-2 text-center">
                    <input type="checkbox" checked={s.channels[c]} onChange={() => { toggleNotification(s.module, c); force((n) => n + 1); }} aria-label={`${s.module} ${notificationChannelLabels[c]}`} className="size-4 accent-[var(--color-primary,#18b0c8)]" />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">Only <span className="font-medium text-foreground">in-app</span> notifications are live. Push, email, SMS and WhatsApp require connecting a provider under Integrations — toggling them here records the preference only.</p>
    </div>
  );
}
