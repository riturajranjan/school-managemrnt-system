"use client";

import { Bookmark, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSisStore } from "@/lib/hooks/use-store";
import { removeSavedView, saveView } from "@/lib/services/views-service";
import type { SavedViewScope } from "@/lib/types/views";

export function SavedViewsMenu({
  scope,
  currentFilters,
  onApply,
}: {
  scope: SavedViewScope;
  currentFilters: Record<string, unknown>;
  onApply: (filters: Record<string, unknown>) => void;
}) {
  const db = useSisStore();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const views = db.savedViews.filter((v) => v.scope === scope);

  return (
    <DropdownMenu onOpenChange={(open) => !open && setNaming(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline">
          <Bookmark className="size-4" aria-hidden="true" />
          <span className="hidden sm:inline">Saved views</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Saved views</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {views.length === 0 && !naming && <p className="px-sm py-sm text-xs text-muted-foreground">No saved views yet.</p>}
        {views.map((view) => (
          <div key={view.id} className="flex items-center gap-1">
            <DropdownMenuItem className="flex-1" onSelect={() => onApply(view.filters)}>
              {view.name}
            </DropdownMenuItem>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                removeSavedView(view.id);
              }}
              className="mr-1 flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-surface-secondary hover:text-error focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={`Delete ${view.name}`}
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
        <DropdownMenuSeparator />
        {naming ? (
          <div className="flex items-center gap-1 p-1">
            <Input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="View name"
              className="h-8 text-xs"
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) {
                  saveView(scope, name.trim(), currentFilters);
                  setName("");
                  setNaming(false);
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (name.trim()) saveView(scope, name.trim(), currentFilters);
                setName("");
                setNaming(false);
              }}
            >
              Save
            </Button>
          </div>
        ) : (
          <DropdownMenuItem
            onSelect={(e) => {
              e.preventDefault();
              setNaming(true);
            }}
          >
            <Plus className="size-3.5" />
            Save current filters
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
