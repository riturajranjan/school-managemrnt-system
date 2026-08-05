import { setState } from "@/lib/data/store";
import type { SavedView, SavedViewScope } from "@/lib/types/views";
import { generateId } from "@/lib/utils";

export function saveView(scope: SavedViewScope, name: string, filters: Record<string, unknown>) {
  const view: SavedView = { id: generateId("view"), scope, name, filters, createdAt: new Date().toISOString() };
  setState((db) => ({ ...db, savedViews: [...db.savedViews, view] }));
  return view;
}

export function removeSavedView(id: string) {
  setState((db) => ({ ...db, savedViews: db.savedViews.filter((v) => v.id !== id) }));
}
