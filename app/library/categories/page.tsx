"use client";

import { useState } from "react";
import { Plus, Tags } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { createCategory } from "@/lib/services/library-reference-service";
import { roleLabels } from "@/lib/permissions/roles";

export default function CategoriesPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [name, setName] = useState("");
  const [classification, setClassification] = useState("");
  const [, force] = useState(0);

  if (!can("library.view"))
    return (
      <PermissionDenied action="view categories" role={roleLabels[role]} />
    );
  const canManage = can("library.manageCatalogue");

  function add() {
    if (!name.trim()) return;
    createCategory({ name, classification: classification || undefined });
    setName("");
    setClassification("");
    force((n) => n + 1);
  }

  return (
    <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Categories</h1>
        <p className="text-xs text-muted-foreground">
          Classification and Dewey / custom codes
        </p>
      </div>

      {canManage && (
        <div className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-md sm:flex-row sm:items-end">
          <div className="flex-1">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Category name"
              aria-label="Category name"
            />
          </div>
          <div className="sm:w-32">
            <Input
              value={classification}
              onChange={(e) => setClassification(e.target.value)}
              placeholder="Dewey e.g. 500"
              aria-label="Classification"
            />
          </div>
          <Button onClick={add}>
            <Plus className="size-4" /> Add
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-sm">
        {db.bookCategories.map((c) => {
          const count = db.books.filter((b) => b.categoryId === c.id).length;
          return (
            <div
              key={c.id}
              className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
              <div className="flex items-center gap-sm">
                <span className="flex size-8 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Tags className="size-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {c.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {c.classification
                      ? `Class ${c.classification}`
                      : "No classification"}
                  </p>
                </div>
              </div>
              <Badge tone="neutral">{count} title(s)</Badge>
            </div>
          );
        })}
      </div>
    </div>
  );
}
