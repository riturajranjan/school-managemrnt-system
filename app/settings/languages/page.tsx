"use client";

import { useState } from "react";
import { Languages } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { UnsavedBar } from "@/components/settings/unsaved-bar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { saveLocalization } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";

const AVAILABLE = [{ code: "en", label: "English" }, { code: "hi", label: "हिन्दी (Hindi)" }, { code: "ta", label: "தமிழ் (Tamil)" }, { code: "bn", label: "বাংলা (Bengali)" }, { code: "mr", label: "मराठी (Marathi)" }];

export default function LanguagesPage() {
  const { role } = usePermissions();
  const stored = useAdmin().localization;
  const [enabled, setEnabled] = useState(() => new Set(stored.enabledLanguages.filter((l) => l.enabled).map((l) => l.code)));
  const [defaultLang, setDefaultLang] = useState(stored.defaultLanguage);
  const [saved, setSaved] = useState(false);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage languages" role={roleLabels[role]} backHref="/settings" />;

  const dirty = JSON.stringify([...enabled].sort()) !== JSON.stringify(stored.enabledLanguages.filter((l) => l.enabled).map((l) => l.code).sort()) || defaultLang !== stored.defaultLanguage;
  const toggle = (code: string) => { setEnabled((s) => { const n = new Set(s); if (n.has(code)) { if (code !== defaultLang) n.delete(code); } else n.add(code); return n; }); setSaved(false); };

  const save = () => {
    saveLocalization({ ...stored, defaultLanguage: defaultLang, enabledLanguages: AVAILABLE.map((l) => ({ code: l.code, label: l.label, enabled: enabled.has(l.code) })) });
    setSaved(true);
  };

  return (
    <div className="flex flex-col gap-md pb-24 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Languages className="size-5 text-primary" /> Languages</h1><p className="text-xs text-muted-foreground">Enable languages and set the default</p></div>

      <div className="flex flex-col gap-xs">
        {AVAILABLE.map((l) => {
          const on = enabled.has(l.code);
          return (
            <div key={l.code} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-sm">
              <span className="flex items-center gap-2 text-foreground">{l.label} {defaultLang === l.code && <Badge tone="info">Default</Badge>}</span>
              <div className="flex items-center gap-2">
                {on && defaultLang !== l.code && <Button size="sm" variant="ghost" onClick={() => { setDefaultLang(l.code); setSaved(false); }}>Set default</Button>}
                <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={on} disabled={l.code === defaultLang} onChange={() => toggle(l.code)} aria-label={`Enable ${l.label}`} /> {on ? "Enabled" : "Disabled"}</label>
              </div>
            </div>
          );
        })}
      </div>
      <p className="rounded-md border border-border bg-surface-secondary/40 p-sm text-xs text-muted-foreground">The architecture supports additional languages; translation content management would require a backend. English and Hindi are the seeded mock locales.</p>
      <UnsavedBar dirty={dirty} saved={saved} onSave={save} onDiscard={() => { setEnabled(new Set(stored.enabledLanguages.filter((x) => x.enabled).map((x) => x.code))); setDefaultLang(stored.defaultLanguage); setSaved(false); }} />
    </div>
  );
}
