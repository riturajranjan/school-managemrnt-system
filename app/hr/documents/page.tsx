"use client";

import Link from "next/link";
import { useState } from "react";
import { ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { staffDocumentStatusTone, staffDocumentTypeLabels, type StaffDocumentStatus } from "@/lib/types/hr";

export default function StaffDocumentsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [filter, setFilter] = useState<"queue" | "all">("queue");
  if (!can("hr.view")) return <PermissionDenied action="view staff documents" role={roleLabels[role]} backHref="/hr" />;

  const empName = (id: string) => { const e = db.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };
  const needsAction: StaffDocumentStatus[] = ["uploaded", "expiring", "expired", "missing", "rejected"];
  const queue = db.staffDocuments.filter((d) => needsAction.includes(d.status));
  const rows = filter === "queue" ? queue : db.staffDocuments;

  const counts = { verified: db.staffDocuments.filter((d) => d.status === "verified").length, pending: db.staffDocuments.filter((d) => d.status === "uploaded").length, expiring: db.staffDocuments.filter((d) => d.status === "expiring" || d.status === "expired").length, missing: db.staffDocuments.filter((d) => d.status === "missing").length };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff documents</h1>
          <p className="text-xs text-muted-foreground">{counts.verified} verified · {counts.pending} to verify · {counts.expiring} expiring · {counts.missing} missing</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5">
          {(["queue", "all"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f === "queue" ? "Verification queue" : "All"}</button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ScrollText className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Nothing in the verification queue.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.slice(0, 80).map((d) => (
            <div key={d.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="min-w-0">
                <Link href={`/hr/staff/${d.employeeId}`} className="truncate text-sm font-medium text-foreground hover:underline">{empName(d.employeeId)}</Link>
                <p className="truncate text-xs text-muted-foreground">{staffDocumentTypeLabels[d.type]}{d.expiryDate ? ` · expires ${d.expiryDate}` : ""}</p>
              </div>
              <div className="flex items-center gap-xs">
                <Badge tone={staffDocumentStatusTone[d.status]}>{d.status}</Badge>
                {can("hr.manageDocuments") && d.status === "uploaded" && <Button size="sm" variant="outline">Verify</Button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
