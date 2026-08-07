"use client";

import { useMemo, useState } from "react";
import { Eye, RotateCw, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { IdCard } from "./id-card";
import { useSisStore } from "@/lib/hooks/use-store";
import { reissueIdCard, setIdCardStatus } from "@/lib/services/documents-service";
import { idCardKindLabels, idCardStatusLabels, idCardStatusTone, type IdCardKind, type IdCardRecord } from "@/lib/types/documents";

/** Shared ID-card list + preview + lifecycle actions for one card kind. Reused
 * by every /id-cards/{students,staff,library,transport,hostel} route. */
export function IdCardManager({ kind, canManage }: { kind: IdCardKind; canManage: boolean }) {
  const db = useSisStore();
  const [, force] = useState(0);
  const [query, setQuery] = useState("");
  const [side, setSide] = useState<"front" | "back">("front");
  const [openId, setOpenId] = useState<string | null>(null);

  const cards = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.idCards.filter((c) => c.kind === kind).filter((c) => (q ? c.holderName.toLowerCase().includes(q) || c.cardNumber.toLowerCase().includes(q) : true));
  }, [db.idCards, kind, query]);
  const selected = cards.find((c) => c.id === openId) ?? null;
  const bump = () => force((n) => n + 1);

  return (
    <div className="flex flex-col gap-md">
      <div className="relative max-w-sm"><Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={`Search ${idCardKindLabels[kind]} cards…`} aria-label="Search cards" className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary" /></div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm">
              <div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{c.holderName}</p><p className="truncate text-xs text-muted-foreground">{c.subtitle} · {c.cardNumber}</p></div>
              <Badge tone={idCardStatusTone[c.status]}>{idCardStatusLabels[c.status]}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{c.status === "not-generated" ? "Not yet generated" : `Expires ${c.expiryDate}`}</p>
            <div className="flex flex-wrap gap-1">
              <Button size="sm" variant="outline" onClick={() => { setOpenId(c.id); setSide("front"); }}><Eye className="size-3.5" /> Preview</Button>
              {canManage && c.status === "not-generated" && <Button size="sm" onClick={() => { setIdCardStatus(c.id, "generated"); bump(); }}>Generate</Button>}
              {canManage && c.status === "generated" && <Button size="sm" onClick={() => { setIdCardStatus(c.id, "issued"); bump(); }}>Mark issued</Button>}
              {canManage && (c.status === "issued" || c.status === "expired") && <Button size="sm" variant="ghost" onClick={() => { reissueIdCard(c.id); bump(); }}><RotateCw className="size-3.5" /> Reissue</Button>}
            </div>
          </div>
        ))}
        {cards.length === 0 && <div className="col-span-full rounded-lg border border-dashed border-border p-2xl text-center text-sm text-muted-foreground">No {idCardKindLabels[kind]} cards found.</div>}
      </div>

      <DetailDrawer open={Boolean(selected)} onOpenChange={(o) => !o && setOpenId(null)} title={selected ? `${selected.holderName} — ${idCardKindLabels[selected.kind]} card` : ""} description={selected?.cardNumber}>
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="flex gap-1 rounded-md border border-border bg-surface p-0.5 w-fit">
              <button type="button" onClick={() => setSide("front")} className={`rounded px-2.5 py-1 text-xs font-medium ${side === "front" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Front</button>
              <button type="button" onClick={() => setSide("back")} className={`rounded px-2.5 py-1 text-xs font-medium ${side === "back" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>Back</button>
            </div>
            <IdCard card={selected} side={side} />
            <p className="text-center text-xs text-muted-foreground">CR80 preview · exact card aspect ratio · print-styled (not theme-inverted).</p>
            {canManage && (
              <div className="flex flex-wrap justify-center gap-xs">
                {selected.status !== "printed" && <Button size="sm" variant="outline" onClick={() => { setIdCardStatus(selected.id, "printed"); bump(); }}>Print (simulation)</Button>}
                {selected.status !== "cancelled" && <Button size="sm" variant="ghost" onClick={() => { setIdCardStatus(selected.id, "cancelled"); bump(); }}>Cancel</Button>}
              </div>
            )}
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

export function idCardKindTitle(kind: IdCardKind) { return `${idCardKindLabels[kind]} ID cards`; }
export type { IdCardRecord };
