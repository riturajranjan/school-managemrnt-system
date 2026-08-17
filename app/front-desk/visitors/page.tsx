"use client";

// Real PostgreSQL/API cutover (Phase 9I). Server-side status filtering
// (status=checked_in for "inside", status=expected for "expected", date=
// today for "today"). Check-in/check-out are server-authoritative
// transitions — no client-side status mutation.
import Link from "next/link";
import { useMemo, useState } from "react";
import { LogIn, LogOut, ScanLine, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/communication/person-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { checkInVisitRequest, checkOutVisitRequest, useVisits } from "@/lib/hooks/api/use-visitors-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { VisitorVisitListItemDto } from "@/lib/api/contracts";

const categoryLabels: Record<string, string> = {
  parent: "Parent", vendor: "Vendor", guest: "Guest", contractor: "Contractor",
  interview_candidate: "Interview candidate", alumni: "Alumni", official: "Official", other: "Other",
};
const statusLabels: Record<string, string> = { expected: "Expected", checked_in: "Checked in", checked_out: "Checked out", cancelled: "Cancelled" };
const statusTone: Record<string, "success" | "warning" | "error" | "info" | "neutral"> = { expected: "info", checked_in: "success", checked_out: "neutral", cancelled: "error" };

export default function VisitorsPage() {
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"today" | "inside" | "expected" | "all">("today");
  const today = new Date().toISOString().slice(0, 10);

  const { data: rows, reload } = useVisits({
    date: tab === "today" ? today : undefined,
    status: tab === "inside" ? "checked_in" : tab === "expected" ? "expected" : undefined,
  });
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? rows.filter((v) => v.visitorName.toLowerCase().includes(q) || v.hostName.toLowerCase().includes(q)) : rows;
  }, [rows, query]);

  if (!can("visitors.view")) return <PermissionDenied action="view visitors" role={roleLabels[role]} backHref="/front-desk" />;
  const canManage = can("visitors.manage");

  async function doCheckIn(id: string) {
    await checkInVisitRequest(id);
    reload();
  }
  async function doCheckOut(id: string) {
    await checkOutVisitRequest(id);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Visitors</h1>
          <p className="text-xs text-muted-foreground">{tab === "today" ? rows.length : filtered.length} in this view</p>
        </div>
        {canManage && <Button asChild size="sm"><Link href="/front-desk/visitors/new"><ScanLine className="size-3.5" /> Check in</Link></Button>}
      </div>

      <div className="flex flex-col gap-sm sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search visitor or host…" className="pl-8" aria-label="Search visitors" />
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["today", "inside", "expected", "all"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{t}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No visitors in this view.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {filtered.map((v: VisitorVisitListItemDto) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex min-w-0 items-center gap-sm">
                <PersonAvatar name={v.visitorName} color="#0f766e" size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{v.visitorName} <span className="text-xs text-muted-foreground">· {categoryLabels[v.category]}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{v.purpose} · {v.hostName}{v.checkedInAt ? ` · in ${new Date(v.checkedInAt).toTimeString().slice(0, 5)}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={statusTone[v.status]}>{statusLabels[v.status]}</Badge>
                {canManage && v.status === "expected" && <Button size="sm" variant="outline" onClick={() => doCheckIn(v.id)}><LogIn className="size-3.5" /> Check in</Button>}
                {canManage && v.status === "checked_in" && <Button size="sm" variant="ghost" onClick={() => doCheckOut(v.id)}><LogOut className="size-3.5" /> Check out</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
