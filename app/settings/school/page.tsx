"use client";

import { useState } from "react";
import { Building2, ImageIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSchoolProfile } from "@/lib/hooks/use-admin";
import { saveSchoolProfile } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import type { SchoolProfile } from "@/lib/types/admin";

const IDENTITY: { k: keyof SchoolProfile; label: string; type?: string }[] = [
  { k: "name", label: "School name" }, { k: "shortName", label: "Short name" }, { k: "code", label: "School code" }, { k: "schoolType", label: "School type" },
  { k: "board", label: "Board" }, { k: "establishedYear", label: "Established year", type: "number" }, { k: "registrationNumber", label: "Registration number" }, { k: "affiliationNumber", label: "Affiliation number" },
];
const CONTACT: { k: keyof SchoolProfile; label: string; type?: string }[] = [
  { k: "website", label: "Website" }, { k: "email", label: "Email", type: "email" }, { k: "phone", label: "Phone" }, { k: "address", label: "Address" },
  { k: "city", label: "City" }, { k: "state", label: "State" }, { k: "country", label: "Country" }, { k: "postalCode", label: "Postal code" }, { k: "timeZone", label: "Time zone" }, { k: "currency", label: "Currency" },
];

export default function SchoolProfilePage() {
  const { role, hasServerPermission } = usePermissions();
  const stored = useSchoolProfile();
  const [form, setForm] = useState<SchoolProfile>(stored);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = hasServerPermission("settings.manage");
  if (!canManage) return <PermissionDenied action="edit the school profile" role={roleLabels[role]} backHref="/settings" />;

  const dirty = JSON.stringify(form) !== JSON.stringify(stored);
  const set = (k: keyof SchoolProfile, v: string | number) => { setForm((f) => ({ ...f, [k]: v })); setSaved(false); };
  const save = () => { const r = saveSchoolProfile(form); if (!r.ok) { setError(r.error); return; } setError(null); setSaved(true); };

  const renderField = (f: { k: keyof SchoolProfile; label: string; type?: string }) => (
    <div key={f.k}><Label htmlFor={`f-${f.k}`}>{f.label}</Label><Input id={`f-${f.k}`} type={f.type ?? "text"} value={String(form[f.k])} onChange={(e) => set(f.k, f.type === "number" ? Number(e.target.value) : e.target.value)} /></div>
  );

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Building2 className="size-5 text-primary" /> School profile</h1><p className="text-xs text-muted-foreground">Organisation details used across documents and portals</p></div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Identity</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">{IDENTITY.map(renderField)}</div>
      </div>

      <div className="surface-3d rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Contact & location</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">{CONTACT.map(renderField)}</div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><ImageIcon className="size-4" aria-hidden /> Branding assets</h2>
        <div className="grid grid-cols-2 gap-sm sm:grid-cols-3 lg:grid-cols-5">
          {[["Logo", form.logoLabel], ["Dark logo", form.darkLogoLabel], ["Favicon", form.faviconLabel], ["School seal", form.sealLabel], ["Letterhead", form.letterheadLabel]].map(([label, val]) => (
            <div key={label} className="flex flex-col items-center gap-1 rounded-md border border-dashed border-border p-sm text-center"><span className="flex size-10 items-center justify-center rounded bg-surface-secondary text-muted-foreground"><ImageIcon className="size-5" aria-hidden /></span><span className="text-xs font-medium text-foreground">{label}</span><span className="truncate text-[10px] text-muted-foreground">{val}</span></div>
          ))}
        </div>
        <p className="mt-sm text-xs text-muted-foreground">Asset upload is a placeholder — no files are stored in this UI phase.</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">{error}</p>}
      <UnsavedBar dirty={dirty} saved={saved} onSave={save} onDiscard={() => { setForm(stored); setSaved(false); }} />
    </div>
  );
}
