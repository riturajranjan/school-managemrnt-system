"use client";

import { useMemo, useState } from "react";
import { ShoppingBag } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMarketplace } from "@/lib/hooks/use-saas";
import { toggleMarketplaceItem } from "@/lib/services/saas-service";
import { marketplaceStatusLabels, type MarketplaceItem } from "@/lib/types/saas";
import { cn } from "@/lib/utils";

const CATS: (MarketplaceItem["category"] | "all")[] = ["all", "communication", "payments", "gps", "storage", "ai", "analytics", "learning"];

export default function MarketplacePage() {
  const items = useMarketplace();
  const [, force] = useState(0);
  const [cat, setCat] = useState<MarketplaceItem["category"] | "all">("all");
  const rows = useMemo(() => (cat === "all" ? items : items.filter((i) => i.category === cat)), [items, cat]);

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><ShoppingBag className="size-5 text-primary" /> Marketplace</h1><p className="text-xs text-muted-foreground">Integrations & add-ons · nothing is actually installed</p></div>
      <div className="flex flex-wrap gap-1">{CATS.map((c) => <button key={c} type="button" onClick={() => setCat(c)} className={cn("rounded-pill px-2.5 py-1 text-xs font-medium capitalize transition", cat === c ? "bg-primary text-primary-foreground" : "bg-surface-secondary text-muted-foreground hover:text-foreground")}>{c}</button>)}</div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((m) => (
          <div key={m.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <div className="flex items-start justify-between gap-sm"><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-surface-secondary text-lg font-bold text-foreground">{m.glyph}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{m.name}</p><p className="truncate text-xs text-muted-foreground">{m.provider} · {m.category}</p></div></div><Badge tone={m.status === "enabled" ? "success" : m.status === "coming-soon" ? "warning" : "neutral"}>{marketplaceStatusLabels[m.status]}</Badge></div>
            <p className="line-clamp-2 text-xs text-muted-foreground">{m.description}</p>
            <p className="text-xs text-muted-foreground">Compatibility: {m.compatibility}</p>
            {m.status === "coming-soon" ? <Button size="sm" variant="outline" disabled>Coming soon</Button> : <Button size="sm" variant={m.status === "enabled" ? "outline" : "primary"} onClick={() => { toggleMarketplaceItem(m.id); force((n) => n + 1); }}>{m.status === "enabled" ? "Disable (mock)" : "Enable (mock)"}</Button>}
          </div>
        ))}
      </div>
    </div>
  );
}
