"use client";

import { useState } from "react";
import { MessagesSquare } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { saveCommunication } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { CommunicationSetting } from "@/lib/types/admin";

export default function CommunicationSettingsPage() {
  const { role } = usePermissions();
  const stored = useAdmin().communication;
  const [form, setForm] = useState<CommunicationSetting>(stored);
  const [saved, setSaved] = useState(false);

  const canManage = role === "super-admin" || role === "administrator" || role === "communication-admin";
  if (!canManage) return <PermissionDenied action="manage communication settings" role={roleLabels[role]} backHref="/settings" />;
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const set = <K extends keyof CommunicationSetting>(k: K, v: CommunicationSetting[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><MessagesSquare className="size-5 text-primary" /> Communication settings</h1><p className="text-xs text-muted-foreground">Sender identity, quiet hours and policies</p></div>
      <div className="surface-3d grid grid-cols-1 gap-sm rounded-lg border border-border bg-surface p-md sm:grid-cols-2">
        <div><Label htmlFor="c-sender">Sender name</Label><Input id="c-sender" value={form.senderName} onChange={(e) => set("senderName", e.target.value)} /></div>
        <div><Label htmlFor="c-lang">Default language</Label><Input id="c-lang" value={form.defaultLanguage} onChange={(e) => set("defaultLanguage", e.target.value)} /></div>
        <div><Label htmlFor="c-qs">Quiet hours start</Label><Input id="c-qs" type="time" value={form.quietHoursStart} onChange={(e) => set("quietHoursStart", e.target.value)} /></div>
        <div><Label htmlFor="c-qe">Quiet hours end</Label><Input id="c-qe" type="time" value={form.quietHoursEnd} onChange={(e) => set("quietHoursEnd", e.target.value)} /></div>
        <div><Label htmlFor="c-ts">Teacher hours start</Label><Input id="c-ts" type="time" value={form.teacherHoursStart} onChange={(e) => set("teacherHoursStart", e.target.value)} /></div>
        <div><Label htmlFor="c-te">Teacher hours end</Label><Input id="c-te" type="time" value={form.teacherHoursEnd} onChange={(e) => set("teacherHoursEnd", e.target.value)} /></div>
        <div className="sm:col-span-2"><Label htmlFor="c-policy">Parent communication policy</Label><Input id="c-policy" value={form.parentPolicy} onChange={(e) => set("parentPolicy", e.target.value)} /></div>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.digestEnabled} onChange={(e) => set("digestEnabled", e.target.checked)} /> Daily digest enabled</label>
        <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.emergencyOverride} onChange={(e) => set("emergencyOverride", e.target.checked)} /> Emergency messages override quiet hours</label>
      </div>
      <UnsavedBar dirty={dirty} saved={saved} onSave={() => { saveCommunication(form); setSaved(true); }} onDiscard={() => { setForm(stored); setSaved(false); }} />
    </div>
  );
}
