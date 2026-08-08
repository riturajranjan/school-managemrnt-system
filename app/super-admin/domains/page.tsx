"use client";

import { useMemo, useState } from "react";
import { Globe, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSisStore } from "@/lib/hooks/use-store";
import { domainStatusLabels, domainStatusTone, type DomainStatus } from "@/lib/types/saas";
import { formatDateTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

const FILTERS: (DomainStatus | "all")[] = ["all", "active", "verification-pending", "setup-required", "error"];

export default function DomainsPage() {
  const db = useSisStore();
  const [filter, setFilter] = useState<DomainStatus | "all">("all");
  const tenantName = (id: string) => db.saas.tenants.find((t) => t.id === id)?.name ?? id;
  const rows = useMemo(() => db.saas.domains.filter((d) => (filter === "all" ? true : d.status === filter)), [db.saas.domains, filter]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Globe className="size-5 text-primary" /> Custom domains</h1><p className="text-xs text-muted-foreground">{rows.length} domains · no real DNS checks</p></div>
      <div className="flex flex-wrap gap-1">{FILTERS.map((f) => <button key={f} type="button" onClick={() => setFilter(f)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium transition", filter === f ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{f === "all" ? "All" : domainStatusLabels[f]}</button>)}</div>

      <div className="flex flex-col gap-xs">
        {rows.map((d) => (
          <div key={d.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{d.domain}</p><p className="truncate text-xs text-muted-foreground">{tenantName(d.tenantId)} · {d.type} · SSL {d.sslStatus} · checked {formatDateTime(d.lastChecked)}</p></div>
            <Badge tone={domainStatusTone[d.status]}>{domainStatusLabels[d.status]}</Badge>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Info className="size-4" /> Setup instructions (placeholder)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground"><li>Add a CNAME record pointing to <code className="rounded bg-surface-secondary px-1">cname.novyra.app</code>.</li><li>Add the TXT verification record shown in the tenant&apos;s domain settings.</li><li>Wait for verification, then SSL is provisioned automatically.</li></ol>
        <p className="mt-sm text-xs text-muted-foreground">This is instructional UI only — no DNS lookups or SSL provisioning occur.</p>
      </div>
    </div>
  );
}
