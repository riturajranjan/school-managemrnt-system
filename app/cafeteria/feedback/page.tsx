"use client";

import { MessageSquare, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { mealCategoryLabels } from "@/lib/types/cafeteria";
import { timeAgo } from "@/lib/utils";

export default function CafeteriaFeedbackPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("cafeteria.view")) return <PermissionDenied action="view cafeteria feedback" role={roleLabels[role]} backHref="/cafeteria" />;
  const avg = db.cafeteriaFeedback.length ? (db.cafeteriaFeedback.reduce((s, f) => s + f.rating, 0) / db.cafeteriaFeedback.length).toFixed(1) : "—";

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="text-lg font-semibold text-foreground">Feedback</h1><p className="text-xs text-muted-foreground">{db.cafeteriaFeedback.length} responses · avg {avg}/5</p></div>
      {db.cafeteriaFeedback.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center"><MessageSquare className="size-6 text-muted-foreground" /><p className="text-sm text-muted-foreground">No feedback yet.</p></div>
      ) : (
        <div className="flex flex-col gap-sm">
          {[...db.cafeteriaFeedback].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((f) => (
            <div key={f.id} className="rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center justify-between gap-sm"><span className="text-sm font-medium text-foreground">{f.studentName}</span><span className="flex items-center gap-1 text-xs text-warning"><Star className="size-3" /> {f.rating}/5</span></div>
              <p className="text-sm text-muted-foreground">{f.comment}</p>
              <div className="mt-1 flex items-center gap-2"><Badge tone="neutral">{mealCategoryLabels[f.category]}</Badge><span className="text-xs text-muted-foreground">{timeAgo(f.createdAt)}</span></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
