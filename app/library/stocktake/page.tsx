"use client";

// Real PostgreSQL/API cutover (Production migration, Phase A) — reads/writes
// GET/POST /api/library/stocktakes(+/scan,+/complete). Expected/scanned/
// missing counts are always derived live from the real LibraryBookCopy
// register and real scan events — never simulated. At most one stocktake
// can be in progress per school at a time.
import { useMemo, useState } from "react";
import { ClipboardCheck, Play, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useLibraryCopies } from "@/lib/hooks/api/use-library-api";
import {
  completeStocktakeRequest, scanStocktakeRequest, startStocktakeRequest,
  useLibraryStocktake, useLibraryStocktakes,
} from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { LibraryStocktakeScopeDto, LibraryStocktakeStatusDto } from "@/lib/api/contracts";
import { formatDate, formatDateTime } from "@/lib/utils";

const statusTone: Record<LibraryStocktakeStatusDto, "success" | "info"> = { in_progress: "info", completed: "success" };
const statusLabels: Record<LibraryStocktakeStatusDto, string> = { in_progress: "In progress", completed: "Completed" };

export default function StocktakePage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: stocktakes, loading, error, reload } = useLibraryStocktakes();
  const { data: copies } = useLibraryCopies();

  const [scope, setScope] = useState<LibraryStocktakeScopeDto>("full");
  const [shelfLocation, setShelfLocation] = useState("");
  const [scan, setScan] = useState("");
  const [startError, setStartError] = useState<string | null>(null);
  const [scanError, setScanError] = useState<string | null>(null);

  const activeSummary = stocktakes.find((s) => s.status === "in_progress") ?? null;
  const { data: active, reload: reloadActive } = useLibraryStocktake(activeSummary?.id ?? null);
  const shelves = useMemo(() => [...new Set(copies.map((c) => c.shelfLocation).filter((s): s is string => Boolean(s)))].sort(), [copies]);

  if (!capabilitiesLoading && !hasServerPermission("library.view")) return <PermissionDenied action="access stocktakes" role={roleLabels[role]} backHref="/library" />;
  if (!capabilitiesLoading && !hasServerPermission("library.manage")) return <PermissionDenied action="run stocktakes" role={roleLabels[role]} backHref="/library" />;

  async function start() {
    setStartError(null);
    const res = await startStocktakeRequest({ scope, shelfLocation: scope === "shelf" ? shelfLocation || undefined : undefined });
    if (!res.success) return setStartError(res.error.message);
    reload();
  }

  async function doScan() {
    if (!active || !scan.trim()) return;
    setScanError(null);
    const res = await scanStocktakeRequest(active.id, { code: scan.trim() });
    if (!res.success) return setScanError(res.error.message);
    setScan("");
    reloadActive(); reload();
  }

  async function complete() {
    if (!active) return;
    await completeStocktakeRequest(active.id);
    reloadActive(); reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Stocktake</h1>
        <p className="text-xs text-muted-foreground">Verify what&apos;s actually on the shelf against the real copy register · completed stocktakes are permanent</p>
      </div>

      {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}

      {!activeSummary && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Scope</label>
            <Select value={scope} onValueChange={(v) => setScope(v as LibraryStocktakeScopeDto)}>
              <SelectTrigger aria-label="Scope"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Whole library</SelectItem>
                <SelectItem value="shelf">One shelf</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {scope === "shelf" && (
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">Shelf</label>
              <Select value={shelfLocation} onValueChange={setShelfLocation}>
                <SelectTrigger aria-label="Shelf"><SelectValue placeholder="Select a shelf" /></SelectTrigger>
                <SelectContent>
                  {shelves.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={start} disabled={scope === "shelf" && !shelfLocation}>
            <Play className="size-4" /> Start stocktake
          </Button>
        </div>
      )}
      {startError && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{startError}</p>}

      {active && (
        <div className="flex flex-col gap-sm rounded-lg border border-primary/40 bg-surface p-md">
          <div className="flex items-center justify-between gap-sm">
            <div>
              <p className="text-sm font-semibold text-foreground">{active.reference}</p>
              <p className="text-xs text-muted-foreground">
                {active.scope === "shelf" ? `Shelf ${active.shelfLocation}` : "Whole library"} · {active.scannedCount}/{active.expectedCount} scanned · {active.missingCount} missing
              </p>
            </div>
            <Button size="sm" variant="outline" onClick={complete}>
              <ClipboardCheck className="size-3.5" /> Complete
            </Button>
          </div>
          <div className="relative">
            <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} placeholder="Scan copy barcode or accession number and press Enter…" className="pl-8" aria-label="Scan copy" />
          </div>
          {scanError && <p className="text-xs text-error">{scanError}</p>}
          {active.missingCopies.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Not yet found ({active.missingCopies.length})</p>
              <div className="flex flex-wrap gap-xs">
                {active.missingCopies.slice(0, 20).map((c) => (
                  <Badge key={c.id} tone="warning">{c.bookTitle} · {c.accessionNumber}</Badge>
                ))}
                {active.missingCopies.length > 20 && <span className="text-xs text-muted-foreground">+{active.missingCopies.length - 20} more</span>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">History</h2>
        {!loading && stocktakes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No stocktakes yet.</p>
        ) : (
          stocktakes.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.reference}</p>
                <p className="text-xs text-muted-foreground">
                  {s.scope === "shelf" ? `Shelf ${s.shelfLocation}` : "Whole library"} · {formatDate(s.startedAt)} · {s.scannedCount}/{s.expectedCount} found
                  {s.completedAt ? ` · completed ${formatDateTime(s.completedAt)}` : ""}
                </p>
              </div>
              <Badge tone={statusTone[s.status]}>{statusLabels[s.status]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
