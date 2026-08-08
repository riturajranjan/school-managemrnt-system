"use client";

import { useState } from "react";
import { Palette } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useBrandingSettings } from "@/lib/hooks/use-admin";
import { saveBranding } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { BrandingSettings } from "@/lib/types/admin";

export default function BrandingStudioPage() {
  const { role } = usePermissions();
  const stored = useBrandingSettings();
  const [form, setForm] = useState<BrandingSettings>(stored);
  const [saved, setSaved] = useState(false);
  const [preview, setPreview] = useState<"dashboard" | "login" | "sidebar">("dashboard");

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage branding" role={roleLabels[role]} backHref="/settings" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const set = <K extends keyof BrandingSettings>(k: K, v: BrandingSettings[K]) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Palette className="size-5 text-primary" /> Branding Studio</h1><p className="text-xs text-muted-foreground">Colours, sidebar and asset labels · live preview</p></div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* LEFT — settings */}
        <div className="flex flex-col gap-sm">
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Colours</h2>
            <div className="flex flex-col gap-sm">
              {([["primaryColor", "Primary"], ["secondaryColor", "Secondary"], ["accentColor", "Accent"]] as const).map(([k, label]) => (
                <div key={k} className="flex items-center justify-between"><Label htmlFor={`c-${k}`}>{label}</Label><input id={`c-${k}`} type="color" value={form[k]} onChange={(e) => set(k, e.target.value)} className="h-8 w-16 rounded border border-border" /></div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm text-sm font-semibold text-foreground">Layout</h2>
            <div className="flex flex-col gap-sm">
              <div><Label>Sidebar style</Label><Select value={form.sidebarStyle} onValueChange={(v) => set("sidebarStyle", v as BrandingSettings["sidebarStyle"])}><SelectTrigger aria-label="Sidebar style"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="gradient">Gradient (default)</SelectItem><SelectItem value="solid">Solid</SelectItem><SelectItem value="minimal">Minimal</SelectItem></SelectContent></Select></div>
              <div><Label>Login page</Label><Select value={form.loginStyle} onValueChange={(v) => set("loginStyle", v as BrandingSettings["loginStyle"])}><SelectTrigger aria-label="Login style"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="split">Split</SelectItem><SelectItem value="centered">Centered</SelectItem><SelectItem value="card">Card</SelectItem></SelectContent></Select></div>
              <label className="flex items-center gap-2 text-sm text-muted-foreground"><input type="checkbox" checked={form.keepDefaultSidebar} onChange={(e) => set("keepDefaultSidebar", e.target.checked)} /> Keep default sidebar gradient</label>
            </div>
          </div>
          <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">The app sidebar keeps its signature navy→teal gradient unless you explicitly opt out here. Logo/seal uploads are placeholders.</p>
        </div>

        {/* RIGHT — live preview */}
        <div className="flex flex-col gap-sm">
          <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
            {(["dashboard", "login", "sidebar"] as const).map((p) => <button key={p} type="button" onClick={() => setPreview(p)} className={`rounded px-2.5 py-1 text-xs font-medium capitalize ${preview === p ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{p}</button>)}
          </div>
          <div className="rounded-lg border border-border bg-surface-secondary/40 p-md">
            {preview === "sidebar" ? (
              <div className="mx-auto flex h-64 w-56 flex-col gap-2 rounded-lg p-3 text-white" style={{ background: form.keepDefaultSidebar || form.sidebarStyle === "gradient" ? "linear-gradient(180deg, #022c43 0%, #18b0c8 100%)" : form.sidebarStyle === "solid" ? form.secondaryColor : "#0f172a" }}>
                <span className="text-sm font-bold">Novyra</span>
                {["Dashboard", "Students", "Fees", "Settings"].map((n, i) => <span key={n} className={`rounded px-2 py-1 text-xs ${i === 0 ? "bg-white/20" : "text-white/70"}`}>{n}</span>)}
              </div>
            ) : preview === "login" ? (
              <div className="mx-auto max-w-sm overflow-hidden rounded-lg border border-border bg-white shadow" style={{ borderTopColor: form.primaryColor, borderTopWidth: 4 }}>
                <div className="p-6 text-center text-neutral-900"><span className="mx-auto mb-2 flex size-10 items-center justify-center rounded text-white" style={{ background: form.primaryColor }}>N</span><p className="text-sm font-bold">Novyra Public School</p><p className="text-xs text-neutral-500">Sign in to continue</p><div className="mt-3 space-y-2"><div className="h-8 rounded border border-neutral-200" /><div className="h-8 rounded border border-neutral-200" /><div className="h-8 rounded text-white" style={{ background: form.primaryColor }} /></div></div>
              </div>
            ) : (
              <div className="rounded-lg border border-border bg-surface p-3">
                <div className="mb-2 flex items-center justify-between"><span className="text-sm font-semibold text-foreground">Dashboard</span><span className="rounded px-2 py-0.5 text-xs text-white" style={{ background: form.primaryColor }}>Action</span></div>
                <div className="grid grid-cols-3 gap-2">{[form.primaryColor, form.secondaryColor, form.accentColor].map((c, i) => <div key={i} className="rounded-md p-2 text-center text-xs text-white" style={{ background: c }}>Metric</div>)}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <UnsavedBar dirty={dirty} saved={saved} onSave={() => { saveBranding(form); setSaved(true); }} onDiscard={() => { setForm(stored); setSaved(false); }} />
    </div>
  );
}
