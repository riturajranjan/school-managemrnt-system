"use client";

import Link from "next/link";
import { useState } from "react";
import { Layers } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { cancelReservation, expireReservation } from "@/lib/services/reservation-service";
import { roleLabels } from "@/lib/permissions/roles";
import { reservationStatusLabels, type ReservationStatus } from "@/lib/types/library";
import { formatDate } from "@/lib/utils";

const statusTone: Record<ReservationStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  waiting: "info",
  ready: "success",
  collected: "neutral",
  expired: "neutral",
  cancelled: "neutral",
  fulfilled: "success",
};

export default function ReservationsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Librarian", role: roleLabels[role] };
  const [, force] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  if (!can("library.view")) return <PermissionDenied action="view reservations" role={roleLabels[role]} />;
  const canManage = can("library.manageReservations");

  const active = db.libraryReservations.filter((r) => r.status === "waiting" || r.status === "ready");
  const byBook = new Map<string, typeof active>();
  for (const r of active) {
    const list = byBook.get(r.bookId) ?? [];
    list.push(r);
    byBook.set(r.bookId, list);
  }

  const bookTitle = (id: string) => db.books.find((b) => b.id === id)?.title ?? id;
  const memberName = (id: string) => db.libraryMembers.find((m) => m.id === id)?.name ?? id;

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Reservations</h1>
        <p className="text-xs text-muted-foreground">Hold queues, pickup readiness and expiry — queue order is always honoured</p>
      </div>

      {byBook.size === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Layers className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No active reservations right now.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {[...byBook.entries()].map(([bookId, list]) => (
            <div key={bookId} className="rounded-lg border border-border bg-surface p-md">
              <div className="mb-sm flex items-center justify-between gap-sm">
                <Link href={`/library/books/${bookId}`} className="text-sm font-semibold text-foreground hover:underline">{bookTitle(bookId)}</Link>
                <Badge tone="info">{list.length} in queue</Badge>
              </div>
              <ol className="flex flex-col gap-xs">
                {[...list].sort((a, b) => b.priority - a.priority || a.queuePosition - b.queuePosition).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                    <div className="min-w-0">
                      <p className="truncate text-sm text-foreground">#{r.queuePosition} · {memberName(r.memberId)}</p>
                      <p className="text-xs text-muted-foreground">
                        Reserved {formatDate(r.reservedAt)}
                        {r.expiresAt ? ` · pickup by ${formatDate(r.expiresAt)}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs">
                      <Badge tone={statusTone[r.status]}>{reservationStatusLabels[r.status]}</Badge>
                      {canManage && r.status === "ready" && r.expiresAt && r.expiresAt <= today && (
                        <Button size="sm" variant="outline" onClick={() => { expireReservation(r.id, actor); force((n) => n + 1); }}>Release</Button>
                      )}
                      {canManage && (
                        <Button size="sm" variant="ghost" onClick={() => { cancelReservation(r.id, actor, "Cancelled from queue"); force((n) => n + 1); }}>Cancel</Button>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
