"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, ArchiveRestore, Copy, FileStack, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useFeeStructures } from "@/lib/hooks/use-finance";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { archiveFeeStructure, copyFromPreviousSession, duplicateFeeStructure, structureTotal } from "@/lib/services/fee-structure-service";
import { feeFrequencyLabels } from "@/lib/types/fees";

const ACTOR_ROLE = "Finance Administrator";

export default function FeeStructuresPage() {
  const router = useRouter();
  const structures = useFeeStructures();
  const classes = useManagedClasses();
  const db = useSisStore();
  const { can } = usePermissions();
  const canManage = can("fees.manageStructures");

  const [copySource, setCopySource] = useState<string | null>(null);
  const [newSession, setNewSession] = useState("");

  const className = (ids: string[]) => (ids.length === 0 ? "All classes" : ids.map((id) => classes.find((c) => c.id === id)?.name ?? id).join(", "));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Fee structures</h1>
          <p className="text-xs text-muted-foreground">Components, installments and rules per class and session</p>
        </div>
        {canManage && (
          <Button asChild size="sm">
            <Link href="/fees/structures/new">
              <Plus className="size-3.5" />
              New structure
            </Link>
          </Button>
        )}
      </div>

      {structures.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <span className="flex size-11 items-center justify-center rounded-full bg-surface-secondary text-muted-foreground">
            <FileStack className="size-5" />
          </span>
          <p className="text-sm text-muted-foreground">No fee structures yet. Create one to start billing students.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-sm lg:grid-cols-2">
          {structures.map((s) => {
            const items = db.studentFeeItems.filter((i) => i.structureId === s.id);
            const collected = sumMoney(items.map((i) => i.paidAmount), s.currency);
            const billed = sumMoney(items.map((i) => i.billedAmount), s.currency);
            const percent = billed.minorUnits === 0 ? 0 : Math.round((collected.minorUnits / billed.minorUnits) * 100);
            const studentCount = new Set(items.map((i) => i.studentId)).size;
            return (
              <div key={s.id} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
                <div className="flex items-start justify-between gap-sm">
                  <button type="button" onClick={() => router.push(`/fees/structures/${s.id}`)} className="min-w-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <p className="truncate text-sm font-semibold text-foreground hover:underline">{s.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {s.session} · {className(s.applicableClassIds)} · {feeFrequencyLabels[s.frequency]}
                    </p>
                  </button>
                  <Badge tone={s.status === "active" ? "success" : s.status === "draft" ? "neutral" : "warning"}>{s.status}</Badge>
                </div>

                <div className="grid grid-cols-2 gap-sm text-xs sm:grid-cols-4">
                  <div>
                    <p className="text-muted-foreground">Total</p>
                    <p className="font-medium text-foreground">{formatMoney(structureTotal(s), { compact: true })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Components</p>
                    <p className="font-medium text-foreground">{s.components.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Installments</p>
                    <p className="font-medium text-foreground">{s.installments.length}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Students billed</p>
                    <p className="font-medium text-foreground">{studentCount}</p>
                  </div>
                </div>

                {items.length > 0 && (
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>Collection progress</span>
                      <span>{percent}%</span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-pill bg-surface-secondary">
                      <div className={`h-full rounded-pill ${percent >= 80 ? "bg-success" : percent >= 50 ? "bg-warning" : "bg-error"}`} style={{ width: `${Math.min(percent, 100)}%` }} />
                    </div>
                  </div>
                )}

                {canManage && (
                  <div className="flex flex-wrap items-center gap-xs border-t border-border pt-sm">
                    <Button size="sm" variant="outline" asChild>
                      <Link href={`/fees/structures/${s.id}`}>View</Link>
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => duplicateFeeStructure(s.id, { name: "Finance Administrator", role: ACTOR_ROLE })}>
                      <Copy className="size-3.5" />
                      Duplicate
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setCopySource(s.id);
                        setNewSession("");
                      }}
                    >
                      Copy to new session
                    </Button>
                    {s.status === "archived" ? (
                      <Button size="sm" variant="outline" onClick={() => archiveFeeStructure(s.id, { name: "Finance Administrator", role: ACTOR_ROLE })}>
                        <ArchiveRestore className="size-3.5" />
                        Restore
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="text-error" onClick={() => archiveFeeStructure(s.id, { name: "Finance Administrator", role: ACTOR_ROLE })}>
                        <Archive className="size-3.5" />
                        Archive
                      </Button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <DetailDrawer open={copySource !== null} onOpenChange={(open) => !open && setCopySource(null)} title="Copy to a new session" description="Creates a draft structure in the new session, linked back to this one">
        <div className="flex flex-col gap-sm">
          <div>
            <Label htmlFor="new-session">New session</Label>
            <Input id="new-session" value={newSession} onChange={(e) => setNewSession(e.target.value)} placeholder="e.g. 2027-2028" />
          </div>
          <Button
            disabled={!newSession.trim()}
            onClick={() => {
              if (copySource) {
                const copy = copyFromPreviousSession(copySource, newSession.trim(), { name: "Finance Administrator", role: ACTOR_ROLE });
                setCopySource(null);
                if (copy) router.push(`/fees/structures/${copy.id}`);
              }
            }}
          >
            Copy structure
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
