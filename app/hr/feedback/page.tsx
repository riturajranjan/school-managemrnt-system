"use client";

import Link from "next/link";
import { MessagesSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function FeedbackPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view")) return <PermissionDenied action="view feedback" role={roleLabels[role]} backHref="/hr/performance" />;

  // Group feedback per employee (confidential-looking; source is masked in the model).
  const byEmployee = new Map<string, typeof db.hrFeedback>();
  for (const f of db.hrFeedback) { const l = byEmployee.get(f.employeeId) ?? []; l.push(f); byEmployee.set(f.employeeId, l); }
  const empName = (id: string) => { const e = db.employees.find((x) => x.id === id); return e ? `${e.firstName} ${e.lastName}` : id; };

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">360° feedback</h1>
        <p className="text-xs text-muted-foreground">Confidential development feedback — sources are anonymised. Not a public ranking.</p>
      </div>

      {byEmployee.size === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <MessagesSquare className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No feedback collected yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-md">
          {[...byEmployee.entries()].slice(0, 12).map(([eid, list]) => {
            const avg = (list.reduce((s, f) => s + f.rating, 0) / list.length).toFixed(1);
            return (
              <div key={eid} className="rounded-lg border border-border bg-surface p-md">
                <div className="mb-sm flex items-center justify-between gap-sm">
                  <Link href={`/hr/staff/${eid}`} className="text-sm font-semibold text-foreground hover:underline">{empName(eid)}</Link>
                  <Badge tone="info"><Star className="size-3" /> {avg} avg · {list.length} inputs</Badge>
                </div>
                <div className="flex flex-col gap-xs">
                  {list.map((f) => (
                    <div key={f.id} className="rounded-md border border-border p-sm">
                      <div className="flex items-center justify-between gap-sm">
                        <span className="text-xs font-medium text-muted-foreground">{f.fromMasked}</span>
                        <span className="text-xs text-foreground">{f.rating}/5 · {formatDate(f.submittedAt)}</span>
                      </div>
                      <p className="mt-1 text-sm text-foreground">{f.comment}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
