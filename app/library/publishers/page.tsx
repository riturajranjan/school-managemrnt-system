"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createPublisher } from "@/lib/services/library-reference-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function PublishersPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [, force] = useState(0);

  if (!can("library.view")) return <PermissionDenied action="view publishers" role={roleLabels[role]} />;
  const canManage = can("library.manageCatalogue");

  function add() {
    if (!name.trim()) return;
    createPublisher({ name, city: city || undefined });
    setName("");
    setCity("");
    force((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Publishers</h1>
        <p className="text-xs text-muted-foreground">Publisher directory</p>
      </div>

      {canManage && (
        <div className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-md sm:flex-row">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Publisher name" aria-label="Publisher name" className="flex-1" />
          <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="City" aria-label="City" className="sm:w-40" />
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.publishers.map((p) => {
          const count = db.books.filter((b) => b.publisherId === p.id).length;
          return (
            <div key={p.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Building2 className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.city ?? "—"}</p>
                </div>
              </div>
              <Badge tone="neutral">{count}</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
