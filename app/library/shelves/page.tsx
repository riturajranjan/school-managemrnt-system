"use client";

import { QrCode } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { shelfStocktakeStatusLabels, type ShelfStocktakeStatus } from "@/lib/types/library";

const statusTone: Record<ShelfStocktakeStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  verified: "success",
  due: "warning",
  overdue: "error",
  "in-progress": "info",
  never: "neutral",
};

export default function ShelvesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("library.view")) return <PermissionDenied action="view shelves" role={roleLabels[role]} />;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Shelves</h1>
        <p className="text-xs text-muted-foreground">Location hierarchy and occupancy · Zone › Floor › Section › Rack › Shelf</p>
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
        {db.shelves.map((shelf) => {
          const copies = db.bookCopies.filter((c) => c.shelfId === shelf.id && c.loanStatus !== "withdrawn");
          const occupied = copies.length;
          const missing = copies.filter((c) => c.condition === "lost").length;
          const slots = Math.max(shelf.capacity, occupied);
          const fillPercent = Math.min(100, Math.round((occupied / Math.max(1, shelf.capacity)) * 100));
          return (
            <div key={shelf.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
              <div className="flex items-start justify-between gap-sm">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{shelf.label}</p>
                  <p className="truncate text-xs text-muted-foreground">{shelf.path}</p>
                </div>
                <Badge tone={statusTone[shelf.stocktakeStatus]}>{shelfStocktakeStatusLabels[shelf.stocktakeStatus]}</Badge>
              </div>

              {/* Lightweight isometric-style occupancy grid — raised slot nodes */}
              <div className="flex flex-wrap gap-[3px] rounded-md bg-surface-secondary/50 p-sm" aria-hidden="true">
                {Array.from({ length: Math.min(48, slots) }).map((_, i) => {
                  const filled = i < occupied;
                  const isMissing = i >= occupied - missing && i < occupied && missing > 0;
                  return (
                    <span
                      key={i}
                      className="h-3 w-2 rounded-[1px] shadow-sm transition-transform"
                      style={{
                        background: isMissing ? "var(--color-error, #dc2626)" : filled ? "#18b0c8" : "transparent",
                        border: filled ? "none" : "1px solid var(--color-border)",
                        transform: filled ? "translateY(-1px)" : "none",
                      }}
                    />
                  );
                })}
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {occupied}/{shelf.capacity} occupied ({fillPercent}%)
                  {missing > 0 ? ` · ${missing} missing` : ""}
                </span>
                <Button asChild size="sm" variant="ghost">
                  <Link href={`/library/qr?shelf=${shelf.id}`}>
                    <QrCode className="size-3.5" /> QR
                  </Link>
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
