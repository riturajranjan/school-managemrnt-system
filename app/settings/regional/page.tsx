"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { saveRegional } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { RegionalSettings } from "@/lib/types/admin";

export default function RegionalPage() {
  const { role, hasServerPermission } = usePermissions();
  const stored = useAdmin().regional;
  const [form, setForm] = useState<RegionalSettings>(stored);
  const [saved, setSaved] = useState(false);

  const canManage = hasServerPermission("settings.manage");
  if (!canManage) return <PermissionDenied action="manage regional settings" role={roleLabels[role]} backHref="/settings" />;
  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const set = <K extends keyof RegionalSettings>(k: K, v: RegionalSettings[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Globe className="size-5 text-primary" /> Regional settings</h1><p className="text-xs text-muted-foreground">Country, time zone, currency and formats</p></div>
      <div className="surface-3d grid grid-cols-1 gap-sm rounded-lg border border-border bg-surface p-md sm:grid-cols-2">
        <div><Label htmlFor="r-country">Country</Label><Input id="r-country" value={form.country} onChange={(e) => set("country", e.target.value)} /></div>
        <div><Label htmlFor="r-state">State / region</Label><Input id="r-state" value={form.state} onChange={(e) => set("state", e.target.value)} /></div>
        <div><Label htmlFor="r-tz">Time zone</Label><Input id="r-tz" value={form.timeZone} onChange={(e) => set("timeZone", e.target.value)} /></div>
        <div><Label>Currency</Label><Select value={form.currency} onValueChange={(v) => set("currency", v)}><SelectTrigger aria-label="Currency"><SelectValue /></SelectTrigger><SelectContent>{["INR", "USD", "AED", "GBP"].map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
        <div><Label htmlFor="r-ay">Academic year format</Label><Input id="r-ay" value={form.academicYearFormat} onChange={(e) => set("academicYearFormat", e.target.value)} /></div>
        <div><Label htmlFor="r-fy">Financial year</Label><Input id="r-fy" value={form.financialYear} onChange={(e) => set("financialYear", e.target.value)} /></div>
        <div><Label>Date format</Label><Select value={form.dateFormat} onValueChange={(v) => set("dateFormat", v)}><SelectTrigger aria-label="Date format"><SelectValue /></SelectTrigger><SelectContent>{["DD MMM YYYY", "DD/MM/YYYY", "MM/DD/YYYY"].map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent></Select></div>
        <div><Label>First day of week</Label><Select value={form.firstDayOfWeek} onValueChange={(v) => set("firstDayOfWeek", v as "sunday" | "monday")}><SelectTrigger aria-label="First day of week"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="monday">Monday</SelectItem><SelectItem value="sunday">Sunday</SelectItem></SelectContent></Select></div>
        <div><Label htmlFor="r-phone">Phone format</Label><Input id="r-phone" value={form.phoneFormat} onChange={(e) => set("phoneFormat", e.target.value)} /></div>
      </div>
      <UnsavedBar dirty={dirty} saved={saved} onSave={() => { saveRegional(form); setSaved(true); }} onDiscard={() => { setForm(stored); setSaved(false); }} />
    </div>
  );
}
