"use client";

// Health Medications (Production migration, Phase C2) — real PostgreSQL/API
// cutover. This is a factual, cross-visit log of medications already
// administered during infirmary visits — NOT a due/scheduled medication
// board (no schedule/dosage/prescription authority exists in the real
// schema; the old mock's "due/scheduled/held" concept is dropped along with
// it). Content is restricted to health.viewSensitive — there is no
// non-sensitive projection of a medication record worth showing.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Pill, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PrivacyNotice, RestrictedHealth } from "@/components/campus/privacy";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useHealthMedications } from "@/lib/hooks/api/use-health-api";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDateTime } from "@/lib/utils";

const PAGE_SIZE = 20;

export default function MedicationsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput, 250);
  const [page, setPage] = useState(1);
  const { data: rows, meta, loading, error, reload } = useHealthMedications({ search: debouncedSearch || undefined, page, pageSize: PAGE_SIZE });

  if (!capabilitiesLoading && !hasServerPermission("health.view")) return <PermissionDenied action="view medication records" role={roleLabels[role]} backHref="/health" />;
  if (!capabilitiesLoading && !hasServerPermission("health.viewSensitive")) {
    return (
      <div className="flex flex-col gap-md pb-20 sm:pb-0">
        <div><h1 className="text-lg font-semibold text-foreground">Medication administration</h1></div>
        <PrivacyNotice />
        <RestrictedHealth label="medication records" />
      </div>
    );
  }
  const isFiltered = searchInput.trim().length > 0;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Medication administration</h1><p className="text-xs text-muted-foreground">Factual record of medication already given — not a schedule</p></div>
      <PrivacyNotice />

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load medication records: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>Retry</Button>
        </div>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={searchInput}
          onChange={(e) => { setSearchInput(e.target.value); setPage(1); }}
          placeholder="Search medication name…"
          aria-label="Search medication records"
          className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
        />
      </div>

      {loading && rows.length === 0 ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading medication records…</p>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Pill className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{isFiltered ? "No medication records match your search." : "No medication records."}</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((m) => (
            <div key={m.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{m.patientName} <span className="text-xs text-muted-foreground">· {m.patientRef}</span></p>
                <p className="truncate text-xs text-muted-foreground">{m.medicationName}{m.quantity ? ` · ${m.quantity}${m.unit ? ` ${m.unit}` : ""}` : ""} · {formatDateTime(m.administeredAt)}</p>
                <p className="text-xs text-muted-foreground">{m.administeredByStaffName ?? "Unattributed"}{m.notes ? ` · ${m.notes}` : ""}</p>
              </div>
              <Badge tone={m.visitStatus === "referred" ? "error" : m.visitStatus === "open" ? "warning" : "neutral"}>{m.visitStatus}</Badge>
            </div>
          ))}
        </div>
      )}

      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between gap-sm text-sm">
          <span className="text-muted-foreground">Page {meta.page} of {totalPages} · {meta.total} total</span>
          <div className="flex gap-xs">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}><ChevronLeft className="size-3.5" /> Prev</Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>Next <ChevronRight className="size-3.5" /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
