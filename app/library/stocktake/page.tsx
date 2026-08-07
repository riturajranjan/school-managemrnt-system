"use client";

import { useState } from "react";
import { ClipboardCheck, Play, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { completeStocktake, createStocktake, scanStocktakeItem } from "@/lib/services/library-stocktake-service";
import { roleLabels } from "@/lib/permissions/roles";
import { stocktakeScopeLabels, stocktakeStatusLabels, type StocktakeScope, type StocktakeStatus } from "@/lib/types/library";
import { formatDate } from "@/lib/utils";

const statusTone: Record<StocktakeStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  draft: "neutral",
  "in-progress": "info",
  review: "warning",
  completed: "success",
  cancelled: "neutral",
};

export default function StocktakePage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Librarian", role: roleLabels[role] };
  const [scope, setScope] = useState<StocktakeScope>("shelf");
  const [target, setTarget] = useState<string>("");
  const [scan, setScan] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, force] = useState(0);

  if (!can("library.manageStocktake")) return <PermissionDenied action="run stocktakes" role={roleLabels[role]} />;

  const active = db.libraryStocktakes.find((s) => s.id === activeId && s.status === "in-progress");

  function start() {
    const result = createStocktake({ libraryId: db.libraries[0]?.id ?? "lib-main", scope, scopeTargetId: scope === "shelf" || scope === "category" ? target || undefined : undefined }, actor);
    if (result.ok && result.stocktake) setActiveId(result.stocktake.id);
    force((n) => n + 1);
  }

  function doScan() {
    if (!active) return;
    const q = scan.trim().toLowerCase();
    const copy = db.bookCopies.find((c) => c.barcode.toLowerCase() === q || c.accessionNumber.toLowerCase() === q);
    if (copy) {
      scanStocktakeItem(active.id, copy.id, copy.shelfId);
      setScan("");
      force((n) => n + 1);
    }
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Stocktake</h1>
        <p className="text-xs text-muted-foreground">Shelf, category and full-library verification · closed stocktakes are immutable</p>
      </div>

      {!active && (
        <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-muted-foreground">Scope</label>
            <Select value={scope} onValueChange={(v) => setScope(v as StocktakeScope)}>
              <SelectTrigger aria-label="Scope">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(stocktakeScopeLabels) as StocktakeScope[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {stocktakeScopeLabels[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(scope === "shelf" || scope === "category") && (
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-muted-foreground">{scope === "shelf" ? "Shelf" : "Category"}</label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger aria-label="Target">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {(scope === "shelf" ? db.shelves.map((s) => ({ id: s.id, name: s.label })) : db.bookCategories.map((c) => ({ id: c.id, name: c.name }))).map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <Button onClick={start}>
            <Play className="size-4" /> Start stocktake
          </Button>
        </div>
      )}

      {active && (
        <div className="flex flex-col gap-sm rounded-lg border border-primary/40 bg-surface p-md">
          <div className="flex items-center justify-between gap-sm">
            <div>
              <p className="text-sm font-semibold text-foreground">{active.reference}</p>
              <p className="text-xs text-muted-foreground">{stocktakeScopeLabels[active.scope]} · {active.scannedCount}/{active.expectedCount} scanned · {active.misplacedCount} misplaced · {active.unexpectedCount} unexpected</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => { completeStocktake(active.id, actor); setActiveId(null); force((n) => n + 1); }}>
              <ClipboardCheck className="size-3.5" /> Complete
            </Button>
          </div>
          <div className="relative">
            <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={scan} onChange={(e) => setScan(e.target.value)} onKeyDown={(e) => e.key === "Enter" && doScan()} placeholder="Scan copy barcode and press Enter…" className="pl-8" aria-label="Scan copy" />
          </div>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        <h2 className="text-sm font-semibold text-foreground">History</h2>
        {db.libraryStocktakes.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No stocktakes yet.</p>
        ) : (
          db.libraryStocktakes.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{s.reference}</p>
                <p className="text-xs text-muted-foreground">
                  {stocktakeScopeLabels[s.scope]} · {formatDate(s.startedAt)} · {s.missingCount} missing · {s.misplacedCount} misplaced
                </p>
              </div>
              <Badge tone={statusTone[s.status]}>{stocktakeStatusLabels[s.status]}</Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
