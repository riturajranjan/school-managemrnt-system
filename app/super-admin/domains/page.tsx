"use client";

// Real custom domains (Super Admin SA-4L). Reads GET /api/super-admin/domains,
// registers hostnames via POST, and moves lifecycle status via POST
// /[id]/status. HONEST: no DNS lookups / SSL provisioning — a domain stays
// PENDING until a platform admin manually verifies it. No mock store.
import { useState } from "react";
import { Globe, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SchoolPicker } from "@/components/super-admin/school-picker";
import { usePermissions } from "@/components/providers/permissions-provider";
import { createDomainRequest, deleteDomainRequest, setDomainStatusRequest, useDomains } from "@/lib/hooks/api/use-platform-config";
import { formatDateTime } from "@/lib/utils";
import type { StatusTone } from "@/lib/types/common";

const statusTone: Record<string, StatusTone> = { pending: "warning", verified: "success", failed: "error", disabled: "neutral" };
const statusLabel: Record<string, string> = { pending: "Pending verification", verified: "Verified", failed: "Failed", disabled: "Disabled" };

export default function DomainsPage() {
  const { hasServerPermission } = usePermissions();
  const canManage = hasServerPermission("platform.domains.manage");
  const [schoolId, setSchoolId] = useState("");
  const { data, loading, error, reload } = useDomains(schoolId);
  const [hostname, setHostname] = useState("");
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function add() {
    if (!schoolId || !hostname.trim()) return;
    setBusy(true);
    setActionError(null);
    const res = await createDomainRequest({ schoolId, hostname: hostname.trim(), type: "custom" });
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else { setHostname(""); reload(); }
  }

  async function setStatus(id: string, status: "verified" | "disabled" | "pending") {
    setBusy(true);
    setActionError(null);
    const res = await setDomainStatusRequest(id, status);
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  async function remove(id: string) {
    setBusy(true);
    setActionError(null);
    const res = await deleteDomainRequest(id);
    setBusy(false);
    if (!res.success) setActionError(res.error.message);
    else reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Globe className="size-5 text-primary" /> Custom domains</h1>
          <p className="text-xs text-muted-foreground">Manual verification · no automated DNS/SSL checks</p>
        </div>
        <SchoolPicker value={schoolId} onChange={setSchoolId} />
      </div>

      {canManage && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-end">
          <div className="flex-1">
            <label htmlFor="hostname" className="mb-1 block text-xs font-medium text-muted-foreground">Add hostname</label>
            <Input id="hostname" value={hostname} onChange={(e) => setHostname(e.target.value)} placeholder="portal.example-school.com" aria-label="Hostname" />
          </div>
          <Button size="sm" disabled={busy || !schoolId || !hostname.trim()} onClick={() => void add()}>Add domain</Button>
        </div>
      )}

      {actionError && <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">{actionError}</p>}
      {loading && <div className="py-2xl text-center text-sm text-muted-foreground">Loading domains…</div>}
      {error && !loading && <div className="rounded-lg border border-dashed border-error/40 p-md text-center text-sm text-error">Could not load domains: {error}</div>}

      {!loading && !error && (
        <div className="flex flex-col gap-xs">
          {data.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No domains for this school yet.</p>}
          {data.map((d) => (
            <div key={d.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="flex items-center gap-2 truncate font-medium text-foreground">{d.hostname}{d.isPrimary && <Badge tone="info">Primary</Badge>}</p>
                <p className="truncate text-xs text-muted-foreground">{d.school.name} · {d.type}{d.verifiedAt ? ` · verified ${formatDateTime(d.verifiedAt)}` : ""}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={statusTone[d.status] ?? "neutral"}>{statusLabel[d.status] ?? d.status}</Badge>
                {canManage && d.status !== "verified" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus(d.id, "verified")}>Verify (manual)</Button>}
                {canManage && d.status === "verified" && <Button size="sm" variant="outline" disabled={busy} onClick={() => void setStatus(d.id, "disabled")}>Disable</Button>}
                {canManage && <Button size="sm" variant="ghost" className="text-error" disabled={busy} onClick={() => void remove(d.id)}>Remove</Button>}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><Info className="size-4" /> DNS setup (instructional)</h2>
        <ol className="list-decimal space-y-1 pl-5 text-xs text-muted-foreground">
          <li>Add a CNAME record for the hostname pointing to <code className="rounded bg-surface-secondary px-1">cname.novyra.app</code>.</li>
          <li>Add the TXT verification record using the domain&apos;s verification token.</li>
          <li>An operator confirms DNS, then verifies the domain manually above.</li>
        </ol>
        <p className="mt-sm text-xs text-muted-foreground">No DNS lookups or SSL provisioning happen here — verification is a deliberate manual action.</p>
      </div>
    </div>
  );
}
