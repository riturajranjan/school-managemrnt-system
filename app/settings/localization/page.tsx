"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { saveLocalization } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { LocalizationSettings } from "@/lib/types/admin";

export default function LocalizationPage() {
  const { role } = usePermissions();
  const stored = useAdmin().localization;
  const [form, setForm] = useState<LocalizationSettings>(stored);
  const [saved, setSaved] = useState(false);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage localization" role={roleLabels[role]} backHref="/settings" />;
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const set = <K extends keyof LocalizationSettings>(k: K, v: LocalizationSettings[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  const sampleNumber = form.numberFormat === "indian" ? "12,34,567.00" : "1,234,567.00";
  const sampleDate = form.dateFormat.replace("DD", "08").replace("MMM", "Aug").replace("YYYY", "2026");
  const sampleTime = form.timeFormat === "12h" ? "9:30 AM" : "09:30";

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Globe className="size-5 text-primary" /> Localization</h1><p className="text-xs text-muted-foreground">Language and formatting defaults</p></div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[minmax(0,1fr)_260px]">
        <div className="surface-3d grid grid-cols-1 gap-sm rounded-lg border border-border bg-surface p-md sm:grid-cols-2">
          <div><Label>Default language</Label><Select value={form.defaultLanguage} onValueChange={(v) => set("defaultLanguage", v)}><SelectTrigger aria-label="Default language"><SelectValue /></SelectTrigger><SelectContent>{form.enabledLanguages.filter((l) => l.enabled).map((l) => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Date format</Label><Select value={form.dateFormat} onValueChange={(v) => set("dateFormat", v)}><SelectTrigger aria-label="Date format"><SelectValue /></SelectTrigger><SelectContent>{["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY", "YYYY-MM-DD"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Time format</Label><Select value={form.timeFormat} onValueChange={(v) => set("timeFormat", v as "12h" | "24h")}><SelectTrigger aria-label="Time format"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="12h">12-hour</SelectItem><SelectItem value="24h">24-hour</SelectItem></SelectContent></Select></div>
          <div><Label>Week starts</Label><Select value={form.weekStart} onValueChange={(v) => set("weekStart", v as "sunday" | "monday")}><SelectTrigger aria-label="Week start"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monday">Monday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent></Select></div>
          <div><Label>Number format</Label><Select value={form.numberFormat} onValueChange={(v) => set("numberFormat", v as "indian" | "international")}><SelectTrigger aria-label="Number format"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="indian">Indian (12,34,567)</SelectItem><SelectItem value="international">International (1,234,567)</SelectItem></SelectContent></Select></div>
          <div><Label>Currency</Label><Select value={form.currency} onValueChange={(v) => set("currency", v)}><SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger><SelectContent>{["INR", "USD", "AED", "GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm text-sm font-semibold text-foreground">Preview</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted-foreground">Date</dt><dd className="text-foreground">{sampleDate}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Time</dt><dd className="text-foreground">{sampleTime}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Number</dt><dd className="text-foreground">{sampleNumber}</dd></div>
            <div className="flex justify-between"><dt className="text-muted-foreground">Currency</dt><dd className="text-foreground">{form.currency === "INR" ? "₹" : form.currency === "USD" ? "$" : form.currency === "GBP" ? "£" : "د.إ"}{sampleNumber}</dd></div>
          </dl>
        </div>
      </div>

      <UnsavedBar dirty={dirty} saved={saved} onSave={() => { const r = saveLocalization(form); if (r.ok) setSaved(true); }} onDiscard={() => { setForm(stored); setSaved(false); }} />
    </div>
  );
}
