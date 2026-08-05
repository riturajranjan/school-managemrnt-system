export type SavedViewScope = "admissions" | "students" | "parents";

export type SavedView = {
  id: string;
  scope: SavedViewScope;
  name: string;
  filters: Record<string, unknown>;
  createdAt: string;
};
