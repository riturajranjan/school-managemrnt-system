"use client";

import { Megaphone, Pin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function AnnouncementsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  if (!can("hr.view") && !can("hr.viewOwn")) return <PermissionDenied action="view announcements" role={roleLabels[role]} backHref="/hr" />;

  const sorted = [...db.hrAnnouncements].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.publishedAt.localeCompare(a.publishedAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Announcements</h1>
        <p className="text-xs text-muted-foreground">Staff-wide notices</p>
      </div>

      {sorted.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <Megaphone className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No announcements.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {sorted.map((a) => (
            <div key={a.id} className={`rounded-lg border p-md ${a.pinned ? "border-primary/40 bg-primary/5" : "border-border bg-surface"}`}>
              <div className="mb-1 flex items-center justify-between gap-sm">
                <p className="flex items-center gap-1 text-sm font-semibold text-foreground">{a.pinned && <Pin className="size-3.5 text-primary" />}{a.title}</p>
                <Badge tone="neutral">{a.audience.replace("-", " ")}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{a.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{formatDate(a.publishedAt)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
