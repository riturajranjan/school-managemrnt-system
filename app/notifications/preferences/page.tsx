"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { toggleNotificationChannel, updateNotificationSettings } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { channelLabels, notificationModuleLabels, LIVE_CHANNELS, type CommChannel, type NotificationModule } from "@/lib/types/communication";

const channels: CommChannel[] = ["in-app", "push", "email", "sms", "whatsapp"];

export default function NotificationPreferencesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("comm.viewOwn") && !can("comm.view")) return <PermissionDenied action="manage notification preferences" role={roleLabels[role]} backHref="/notifications" />;

  const settings = db.notificationSettings;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/notifications"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Notification preferences</h1>
          <p className="text-xs text-muted-foreground">Choose how notifications reach you, per module</p>
        </div>
      </div>

      <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
        Only <span className="font-medium">In-app</span> is live. Push, Email, SMS and WhatsApp are future integrations — toggles are saved but no external messages are sent in this build.
      </p>

      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full min-w-[600px] text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs text-muted-foreground">
              <th className="p-sm font-semibold">Module</th>
              {channels.map((ch) => <th key={ch} className="p-sm text-center font-semibold">{channelLabels[ch]}{!LIVE_CHANNELS.includes(ch) && <span className="block text-[10px] font-normal">demo</span>}</th>)}
            </tr>
          </thead>
          <tbody>
            {settings.preferences.map((p) => (
              <tr key={p.module} className="border-b border-border last:border-0">
                <td className="p-sm font-medium text-foreground">{notificationModuleLabels[p.module as NotificationModule]}</td>
                {channels.map((ch) => (
                  <td key={ch} className="p-sm text-center">
                    <Switch checked={p.channels[ch]} onCheckedChange={() => toggleNotificationChannel(p.module, ch)} aria-label={`${notificationModuleLabels[p.module as NotificationModule]} ${channelLabels[ch]}`} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Quiet hours</h2>
          <div className="flex items-center gap-sm">
            <Input type="time" value={settings.quietHoursStart} onChange={(e) => updateNotificationSettings({ quietHoursStart: e.target.value })} aria-label="Quiet hours start" />
            <span className="text-sm text-muted-foreground">to</span>
            <Input type="time" value={settings.quietHoursEnd} onChange={(e) => updateNotificationSettings({ quietHoursEnd: e.target.value })} aria-label="Quiet hours end" />
          </div>
          <label className="mt-sm flex items-center justify-between gap-sm rounded-md border border-border p-sm">
            <span className="text-sm text-foreground">Emergency override</span>
            <Switch checked={settings.emergencyOverride} onCheckedChange={(v) => updateNotificationSettings({ emergencyOverride: v })} />
          </label>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Delivery</h2>
          <div className="flex flex-col gap-sm">
            <div className="flex items-center justify-between gap-sm">
              <span className="text-sm text-foreground">Language</span>
              <Select value={settings.language} onValueChange={(v) => updateNotificationSettings({ language: v as "en" | "hi" })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="en">English</SelectItem><SelectItem value="hi">हिंदी</SelectItem></SelectContent></Select>
            </div>
            <div className="flex items-center justify-between gap-sm">
              <span className="text-sm text-foreground">Digest</span>
              <Select value={settings.digest} onValueChange={(v) => updateNotificationSettings({ digest: v as "off" | "daily" | "weekly" })}><SelectTrigger className="w-28"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="off">Off</SelectItem><SelectItem value="daily">Daily</SelectItem><SelectItem value="weekly">Weekly</SelectItem></SelectContent></Select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
