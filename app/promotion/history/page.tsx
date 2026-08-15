"use client";

// Promotion history (Phase 8E) — real PostgreSQL/API cutover. Every processed
// StudentPromotion decision (never a fictional "run"), filterable and
// paginated, straight from PostgreSQL.
import { useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAcademicSessions, usePromotions } from "@/lib/hooks/api/use-promotions-api";
import { formatDateTime } from "@/lib/utils";

const decisionTone: Record<string, "success" | "warning"> = { promoted: "success", retained: "warning" };

export default function PromotionHistoryPage() {
  const { can } = usePermissions();
  const [toAcademicSessionId, setToAcademicSessionId] = useState("");
  const [decision, setDecision] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data: sessions } = useAcademicSessions();
  const { data: promotions, meta, loading } = usePromotions({ toAcademicSessionId: toAcademicSessionId || undefined, decision: decision || undefined, search: search || undefined, page });

  if (!can("promotion.view")) {
    return <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">You don&apos;t have permission to view promotion history.</p>;
  }

  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Promotion history</h1>
        <p className="text-xs text-muted-foreground">Every promotion/retention decision, across sessions</p>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <div className="flex min-w-[200px] flex-1 items-center gap-sm rounded-md border border-input bg-surface px-sm">
          <Search className="size-4 text-muted-foreground" aria-hidden="true" />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name or admission number" className="border-0 px-0 focus-visible:ring-0" />
        </div>
        <Select value={toAcademicSessionId} onValueChange={(v) => { setToAcademicSessionId(v); setPage(1); }}>
          <SelectTrigger className="w-40" aria-label="Target session">
            <SelectValue placeholder="Any session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={decision} onValueChange={(v) => { setDecision(v); setPage(1); }}>
          <SelectTrigger className="w-32" aria-label="Decision">
            <SelectValue placeholder="Any decision" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="promoted">Promoted</SelectItem>
            <SelectItem value="retained">Retained</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading && !promotions.length ? (
        <p className="py-2xl text-center text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="flex flex-col gap-1">
          {promotions.map((p) => (
            <div key={p.id} className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">
                  {p.student.name} · {p.fromClassName ?? "—"}{p.fromSectionName ? `-${p.fromSectionName}` : ""} → {p.targetClass.name}-{p.targetSection.name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {p.fromSession.name} → {p.toSession.name} · {formatDateTime(p.processedAt)} by {p.processedByName ?? "—"}
                </p>
              </div>
              <Badge tone={decisionTone[p.decision]}>{p.decision === "promoted" ? "Promoted" : "Retained"}</Badge>
            </div>
          ))}
          {promotions.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No promotion decisions yet.</p>}
        </div>
      )}

      {meta && totalPages > 1 && (
        <div className="flex items-center justify-between gap-sm text-sm">
          <span className="text-muted-foreground">Page {meta.page} of {totalPages} · {meta.total} total</span>
          <div className="flex gap-xs">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              <ChevronLeft className="size-3.5" /> Prev
            </Button>
            <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next <ChevronRight className="size-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
