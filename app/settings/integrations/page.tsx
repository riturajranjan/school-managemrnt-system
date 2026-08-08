"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Plug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useIntegrations } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { integrationCategoryLabels, type IntegrationCategory } from "@/lib/types/admin";

export default function IntegrationsPage() {
  const { role } = usePermissions();
  const integrations = useIntegrations();
  const [cat, setCat] = useState<IntegrationCategory | "all">("all");

  const cats = useMemo(() => Array.from(new Set(integrations.map((i) => i.category))), [integrations]);
  const rows = useMemo(() => (cat === "all" ? integrations : integrations.filter((i) => i.category === cat)), [integrations, cat]);

  const canView = role === "super-admin" || role === "administrator";
  if (!canView) return <PermissionDenied action="view integrations" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Plug className="size-5 text-primary" /> Integrations</h1><p className="text-xs text-muted-foreground">Connect external providers · none are connected in this UI phase</p></div>

      <div className="flex flex-wrap gap-1">
        <button type="button" onClick={() => setCat("all")} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${cat === "all" ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>All</button>
        {cats.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={`rounded-pill px-2.5 py-1 text-xs font-medium transition ${cat === c ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground"}`}>{integrationCategoryLabels[c]}</button>)}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((i) => (
          <Link key={i.id} href={`/settings/integrations/${i.id}`} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md transition hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-surface-secondary text-lg font-bold text-foreground">{i.logoGlyph}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{i.name}</p><p className="truncate text-xs text-muted-foreground">{integrationCategoryLabels[i.category]}</p></div></div>
              <Badge tone={i.status === "demo-placeholder" ? "warning" : "neutral"}>{i.status === "demo-placeholder" ? "Demo placeholder" : "Not connected"}</Badge>
            </div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{i.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
