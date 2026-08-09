"use client";

import Link from "next/link";
import { useState } from "react";
import { KeyRound, LogOut, MonitorSmartphone, ScrollText, ShieldCheck, UserCog } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { usePermissions } from "@/components/providers/permissions-provider";
import { MOCK_LOGIN_HISTORY, MOCK_SECURITY_PREFS } from "@/lib/types/auth";
import { roleLabels } from "@/lib/permissions/roles";
import { logout } from "@/app/(auth)/actions";

export default function SecurityPreferencesPage() {
  const { role } = usePermissions();
  const [prefs, setPrefs] = useState(MOCK_SECURITY_PREFS);
  const [logoutOpen, setLogoutOpen] = useState(false);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ShieldCheck className="size-5 text-primary" /> Security</h1><p className="text-xs text-muted-foreground">Signed in as {roleLabels[role]} · settings are frontend simulation</p></div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
        <Link href="/security/2fa" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><ShieldCheck className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Two-step verification</p><p className="text-xs text-muted-foreground">Add a second factor</p></div></Link>
        <Link href="/security/recovery" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><KeyRound className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Recovery codes</p><p className="text-xs text-muted-foreground">Backup access</p></div></Link>
        <Link href="/security/devices" className="surface-3d flex items-center gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40"><span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><MonitorSmartphone className="size-4" /></span><div><p className="text-sm font-semibold text-foreground">Trusted devices</p><p className="text-xs text-muted-foreground">Where you&apos;re signed in</p></div></Link>
      </div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Preferences</h2>
        <div className="flex flex-col gap-xs">
          {prefs.map((p) => (
            <div key={p.key} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
              <div className="min-w-0"><div className="flex items-center gap-2"><p className="font-medium text-foreground">{p.label}</p>{p.backendRequired && <Badge tone="warning">Backend required</Badge>}</div><p className="text-xs text-muted-foreground">{p.description}</p></div>
              <label className="flex items-center gap-1 text-xs text-muted-foreground"><input type="checkbox" checked={p.enabled} onChange={() => setPrefs((list) => list.map((x) => (x.key === p.key ? { ...x, enabled: !x.enabled } : x)))} aria-label={`Toggle ${p.label}`} /> {p.enabled ? "On" : "Off"}</label>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><ScrollText className="size-4" /> Login history</h2>
        <div className="flex flex-col gap-xs">
          {MOCK_LOGIN_HISTORY.map((h, i) => (
            <div key={i} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm"><div className="min-w-0"><p className="truncate text-foreground">{h.device}</p><p className="truncate text-xs text-muted-foreground">{h.location} · {h.at}</p></div><Badge tone={h.result === "success" ? "success" : "error"}>{h.result}</Badge></div>
          ))}
        </div>
        <p className="mt-sm text-xs text-muted-foreground">Login history is placeholder demo data — no real sessions are tracked.</p>
      </section>

      <div className="flex flex-wrap gap-xs">
        <Button asChild size="sm" variant="outline"><Link href="/login"><UserCog className="size-3.5" /> Switch account</Link></Button>
        <Button size="sm" variant="ghost" onClick={() => setLogoutOpen(true)}><LogOut className="size-3.5" /> Sign out</Button>
      </div>

      <DetailDrawer open={logoutOpen} onOpenChange={setLogoutOpen} title="Sign out of Novyra Campus OS?" description="You can sign back in anytime.">
        <div className="flex flex-col gap-sm">
          <Button size="md" onClick={() => { void logout(); }}>Sign out this device</Button>
          <Button asChild size="md" variant="outline"><Link href="/login">Sign out all devices (simulation)</Link></Button>
          <Button size="md" variant="ghost" onClick={() => setLogoutOpen(false)}>Cancel</Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
