"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { LogIn, LogOut, ScanLine, Search, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PersonAvatar } from "@/components/communication/person-avatar";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { setVisitorStatus } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { visitorStatusLabels, visitorStatusTone, visitorTypeLabels } from "@/lib/types/communication";

export default function VisitorsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"today" | "inside" | "expected" | "all">("today");
  const [, force] = useState(0);
  const today = new Date().toISOString().slice(0, 10);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return db.visitors
      .filter((v) => {
        if (tab === "today") return v.date === today;
        if (tab === "inside") return v.status === "checked-in" || v.status === "meeting";
        if (tab === "expected") return v.status === "expected";
        return true;
      })
      .filter((v) => (q ? v.name.toLowerCase().includes(q) || v.hostName.toLowerCase().includes(q) : true));
  }, [db.visitors, query, tab, today]);

  if (!can("frontdesk.view")) return <PermissionDenied action="view visitors" role={roleLabels[role]} backHref="/front-desk" />;
  const canManage = can("frontdesk.manage");

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Visitors</h1>
          <p className="text-xs text-muted-foreground">{db.visitors.filter((v) => v.date === today).length} today</p>
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

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Users className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No visitors in this view.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((v) => (
            <div key={v.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex min-w-0 items-center gap-sm">
                <PersonAvatar name={v.name} color="#0f766e" size="md" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{v.name} <span className="text-xs text-muted-foreground">· {visitorTypeLabels[v.type]}</span></p>
                  <p className="truncate text-xs text-muted-foreground">{v.purpose} · {v.hostName}{v.arrivalTime ? ` · in ${v.arrivalTime}` : ""}</p>
                </div>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={visitorStatusTone[v.status]}>{visitorStatusLabels[v.status]}</Badge>
                {canManage && (v.status === "expected" || v.status === "waiting") && <Button size="sm" variant="outline" onClick={() => { setVisitorStatus(v.id, "checked-in"); force((n) => n + 1); }}><LogIn className="size-3.5" /> Check in</Button>}
                {canManage && (v.status === "checked-in" || v.status === "meeting") && <Button size="sm" variant="ghost" onClick={() => { setVisitorStatus(v.id, "checked-out"); force((n) => n + 1); }}><LogOut className="size-3.5" /> Check out</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
