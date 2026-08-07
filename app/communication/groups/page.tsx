"use client";

import { useState } from "react";
import { Archive, BellOff, Pin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { roleLabels } from "@/lib/permissions/roles";
import { groupTypeLabels, type CommunicationGroup } from "@/lib/types/communication";
import { timeAgo } from "@/lib/utils";

export default function GroupsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [selected, setSelected] = useState<CommunicationGroup | null>(null);

  if (!can("comm.view")) return <PermissionDenied action="view groups" role={roleLabels[role]} backHref="/communication" />;
  const groups = [...db.commGroups].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.lastMessageAt.localeCompare(a.lastMessageAt));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Group conversations</h1>
          <p className="text-xs text-muted-foreground">{groups.length} groups</p>
        </div>
        {can("comm.manageGroups") && <Button size="sm"><Users className="size-3.5" /> Create group</Button>}
      </div>

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {groups.map((g) => (
          <button key={g.id} onClick={() => setSelected(g)} className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md text-left hover:border-primary/40">
            <div className="flex items-start justify-between gap-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary"><Users className="size-4" /></span>
                <div className="min-w-0">
                  <p className="flex items-center gap-1 text-sm font-semibold text-foreground">{g.pinned && <Pin className="size-3 text-primary" />}{g.name}</p>
                  <p className="text-xs text-muted-foreground">{groupTypeLabels[g.type]} · {g.memberCount} members</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {g.muted && <BellOff className="size-3.5 text-muted-foreground" aria-label="Muted" />}
                <span className="text-[10px] text-muted-foreground">{timeAgo(g.lastMessageAt)}</span>
              </div>
            </div>
            <p className="truncate text-xs text-muted-foreground">{g.lastMessagePreview}</p>
          </button>
        ))}
      </div>

      <DetailDrawer open={selected !== null} onOpenChange={(o) => !o && setSelected(null)} title={selected?.name ?? "Group"} description="Group details and settings">
        {selected && (
          <div className="flex flex-col gap-md">
            <div className="flex items-center gap-sm">
              <span className="flex size-12 items-center justify-center rounded-md bg-primary/10 text-primary"><Users className="size-6" /></span>
              <div>
                <p className="text-base font-semibold text-foreground">{selected.name}</p>
                <p className="text-xs text-muted-foreground">{groupTypeLabels[selected.type]} · {selected.memberCount} members</p>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-sm text-center">
              <Stat label="Members" value={String(selected.memberCount)} />
              <Stat label="Admins" value={String(selected.adminIds.length)} />
              <Stat label="Status" value={selected.archived ? "Archived" : "Active"} />
            </div>
            <div className="flex flex-col gap-1">
              <p className="text-sm font-semibold text-foreground">Settings</p>
              {can("comm.manageGroups") ? (
                <div className="flex flex-wrap gap-xs">
                  <Button size="sm" variant="outline"><Pin className="size-3.5" /> {selected.pinned ? "Unpin" : "Pin"}</Button>
                  <Button size="sm" variant="outline"><BellOff className="size-3.5" /> {selected.muted ? "Unmute" : "Mute"}</Button>
                  <Button size="sm" variant="outline"><Users className="size-3.5" /> Manage members</Button>
                  <Button size="sm" variant="ghost"><Archive className="size-3.5" /> Archive</Button>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">You have view-only access to this group.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">Shared media and pinned announcements appear here in a connected build.</p>
          </div>
        )}
      </DetailDrawer>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
