"use client";

// Real Marketplace (Super Admin SA-4M). Shows the DB app catalog and — for a
// selected real school — install/disable per app. HONEST external boundary: no
// OAuth/token exchange/provider connectivity happens; installation persists
// intent + enabled/disabled status only, and every app is clearly labelled as
// not yet connected. No mock store, no fake success.
import { useMemo, useState } from "react";
import { ShoppingBag, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SchoolPicker } from "@/components/super-admin/school-picker";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  disableInstallRequest,
  installAppRequest,
  useMarketplaceApps,
  useSchoolInstalls,
} from "@/lib/hooks/api/use-platform-commerce";
import { cn } from "@/lib/utils";

export default function MarketplacePage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.marketplace.manage");
  const [schoolId, setSchoolId] = useState("");
  const [cat, setCat] = useState<string>("all");
  const catalog = useMarketplaceApps();
  const installs = useSchoolInstalls(schoolId);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const categories = useMemo(() => ["all", ...Array.from(new Set(catalog.data.map((a) => a.category)))], [catalog.data]);
  const rows = useMemo(() => (cat === "all" ? catalog.data : catalog.data.filter((a) => a.category === cat)), [catalog.data, cat]);
  const installByApp = useMemo(() => {
    const m = new Map<string, string>(); // appId → status
    for (const i of installs.data ?? []) m.set(i.app.id, i.status);
    return m;
  }, [installs.data]);

  const refresh = () => { catalog.reload(); installs.reload(); };

  async function install(appId: string) {
    setBusy(appId); setActionError(null);
    const res = await installAppRequest(schoolId, appId);
    setBusy(null);
    if (!res.success) setActionError(res.error.message); else refresh();
  }
  async function disable(appId: string) {
    setBusy(appId); setActionError(null);
    const res = await disableInstallRequest(schoolId, appId);
    setBusy(null);
    if (!res.success) setActionError(res.error.message); else refresh();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ShoppingBag className="size-5 text-primary" /> Marketplace</h1>
          <p className="text-xs text-muted-foreground">Install integrations per school · provider connections not yet configured</p>
        </div>
        <SchoolPicker value={schoolId} onChange={setSchoolId} />
      </div>

      <p className="flex items-start gap-1 rounded-md border border-warning/25 bg-warning/8 p-sm text-xs text-warning">
        <Info className="mt-0.5 size-3.5 shrink-0" /> Installing records intent + enabled status only. No live OAuth/API connection is established yet.
      </p>

      <div className="flex flex-wrap gap-1">
        {categories.map((c) => (
          <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition", cat === c ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{c}</button>
        ))}
      </div>

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {catalog.loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading marketplace…</div>}
      {catalog.error && !catalog.loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load marketplace: {catalog.error}</div>}

      {!catalog.loading && !catalog.error && (
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((m) => {
            const status = installByApp.get(m.id); // installed | disabled | undefined
            const installed = status === "installed";
            const archived = m.status === "archived";
            return (
              <div key={m.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{m.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{m.providerName ?? "—"} · {m.category} · {m.installedSchoolCount} installed</p>
                  </div>
                  <Badge tone={installed ? "success" : status === "disabled" ? "warning" : "neutral"}>{status ? status : "not installed"}</Badge>
                </div>
                <p className="line-clamp-2 text-xs text-muted-foreground">{m.description ?? ""}</p>
                <p className="text-[11px] text-muted-foreground">Connection: not configured yet</p>
                <div className="mt-auto flex items-center gap-2">
                  {canManage && !archived && (installed ? (
                    <Button size="sm" variant="outline" disabled={busy === m.id} onClick={() => void disable(m.id)}>Disable</Button>
                  ) : (
                    <Button size="sm" disabled={busy === m.id} onClick={() => void install(m.id)}>{status === "disabled" ? "Re-enable" : "Install"}</Button>
                  ))}
                  {archived && <Badge tone="neutral">Archived</Badge>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
