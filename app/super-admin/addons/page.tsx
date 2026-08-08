"use client";

import { useState } from "react";
import { Package, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAddons } from "@/lib/hooks/use-saas";
import { formatMinor } from "@/lib/finance/format-minor";

export default function AddonsPage() {
  const addons = useAddons();
  const [added, setAdded] = useState<Set<string>>(new Set());

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><Package className="size-5 text-primary" /> Add-ons</h1><p className="text-xs text-muted-foreground">Extend a school&apos;s plan · frontend simulation</p></div>
      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {addons.map((a) => {
          const on = added.has(a.id);
          return (
            <div key={a.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm"><div className="flex items-center gap-2"><span className="flex size-9 items-center justify-center rounded-md bg-surface-secondary text-lg">{a.glyph}</span><div className="min-w-0"><p className="truncate text-sm font-semibold text-foreground">{a.name}</p><p className="truncate text-xs text-muted-foreground">{a.category}</p></div></div></div>
              <p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p>
              <p className="text-sm font-bold text-foreground">{formatMinor(a.priceMinor)}<span className="text-xs font-normal text-muted-foreground"> {a.unit}</span></p>
              <p className="text-xs text-muted-foreground">Includes {a.includedLimit}</p>
              <Button size="sm" variant={on ? "outline" : "primary"} onClick={() => setAdded((s) => { const n = new Set(s); if (n.has(a.id)) n.delete(a.id); else n.add(a.id); return n; })}>{on ? "Added ✓" : <><Plus className="size-3.5" /> Add (simulation)</>}</Button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
