"use client";

import { useState } from "react";
import { Plus, PenLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createAuthor } from "@/lib/services/library-reference-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function AuthorsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [name, setName] = useState("");
  const [, force] = useState(0);

  if (!can("library.view")) return <PermissionDenied action="view authors" role={roleLabels[role]} />;
  const canManage = can("library.manageCatalogue");

  function add() {
    if (!name.trim()) return;
    createAuthor({ name });
    setName("");
    force((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Authors</h1>
        <p className="text-xs text-muted-foreground">Authors and their catalogue footprint</p>
      </div>

      {canManage && (
        <div className="flex gap-xs rounded-lg border border-border bg-surface p-md">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Author name" aria-label="Author name" className="flex-1" />
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
        {db.authors.map((a) => {
          const count = db.books.filter((b) => b.authorId === a.id).length;
          return (
            <div key={a.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <PenLine className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.nationality ?? "—"}</p>
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
