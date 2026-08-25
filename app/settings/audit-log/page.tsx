"use client";

import { useMemo, useState } from "react";
import { ScrollText, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAuditLog } from "@/lib/hooks/use-admin";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const statusTone = { success: "success", denied: "error", warning: "warning" } as const;

export default function AuditLogPage() {
  const { role, hasServerPermission } = usePermissions();
  const log = useAuditLog();
  const [query, setQuery] = useState("");
  const [module, setModule] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const modules = useMemo(() => Array.from(new Set(log.map((e) => e.module))), [log]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return log.filter((e) => (module === "all" ? true : e.module === module)).filter((e) => (q ? e.actor.toLowerCase().includes(q) || e.action.toLowerCase().includes(q) : true));
  }, [log, query, module]);
  const entry = rows.find((e) => e.id === openId) ?? null;

  const canView = hasServerPermission("settings.view");
  if (!canView) return <PermissionDenied action="view the audit log" role={roleLabels[role]} backHref="/settings" />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ScrollText className="size-5 text-primary" /> Audit log</h1><p className="text-xs text-muted-foreground">{log.length} entries · mock activity trail</p></div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search actor or action…" aria-label="Search audit log" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>
        <select value={module} onChange={(e) => setModule(e.target.value)} aria-label="Module filter" className="rounded-md border border-border bg-surface px-2 py-1.5 text-sm text-foreground"><option value="all">All modules</option>{modules.map((m) => <option key={m} value={m}>{m}</option>)}</select>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-max text-sm">
          <thead><tr className="border-b border-border bg-surface-secondary/60 text-xs text-muted-foreground"><th className="px-sm py-2 text-left">Time</th><th className="px-sm py-2 text-left">Actor</th><th className="px-sm py-2 text-left">Module</th><th className="px-sm py-2 text-left">Action</th><th className="px-sm py-2 text-left">Record</th><th className="px-sm py-2 text-left">Status</th></tr></thead>
          <tbody>
            {rows.slice(0, 40).map((e) => (
              <tr key={e.id} className="cursor-pointer border-b border-border/60 hover:bg-surface-secondary/30" onClick={() => setOpenId(e.id)}>
                <td className="px-sm py-2 text-muted-foreground">{formatDateTime(e.timestamp)}</td>
                <td className="px-sm py-2 text-foreground">{e.actor} <span className="text-xs text-muted-foreground">({roleLabels[e.role as keyof typeof roleLabels] ?? e.role})</span></td>
                <td className="px-sm py-2 text-muted-foreground">{e.module}</td>
                <td className="px-sm py-2 text-foreground">{e.action}</td>
                <td className="px-sm py-2 text-muted-foreground">{e.record}</td>
                <td className="px-sm py-2"><Badge tone={statusTone[e.status]}>{e.status}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Mobile cards */}
      <div className="flex flex-col gap-xs sm:hidden">
        {rows.slice(0, 40).map((e) => (
          <button key={e.id} type="button" onClick={() => setOpenId(e.id)} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm text-left text-sm">
            <div className="min-w-0"><p className="truncate font-medium text-foreground">{e.action} · {e.module}</p><p className="truncate text-xs text-muted-foreground">{e.actor} · {formatDateTime(e.timestamp)}</p></div>
            <Badge tone={statusTone[e.status]}>{e.status}</Badge>
          </button>
        ))}
      </div>

      <DetailDrawer open={Boolean(entry)} onOpenChange={(o) => !o && setOpenId(null)} title={entry ? entry.action : ""} description={entry ? `${entry.module} · ${formatDateTime(entry.timestamp)}` : ""}>
        {entry && (
          <dl className="flex flex-col gap-2 text-sm">
            <Row label="Actor" value={`${entry.actor} (${entry.role})`} />
            <Row label="Module" value={entry.module} />
            <Row label="Record" value={entry.record} />
            <Row label="Branch" value={entry.branch} />
            <Row label="Status" value={entry.status} />
            {entry.previousValue && <Row label="Previous" value={entry.previousValue} />}
            {entry.newValue && <Row label="New" value={entry.newValue} />}
            {entry.reason && <Row label="Reason" value={entry.reason} />}
            <Row label="Session" value="Session metadata placeholder (IP, device) — requires backend." />
          </dl>
        )}
      </DetailDrawer>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-sm border-b border-border/40 pb-1"><dt className="text-muted-foreground">{label}</dt><dd className="text-right text-foreground">{value}</dd></div>;
}
