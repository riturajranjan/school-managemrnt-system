export type FilterOption = { value: string; label: string };

export type FilterFieldConfig =
  | { type: "multi-select"; key: string; label: string; options: FilterOption[] }
  | { type: "select"; key: string; label: string; options: FilterOption[] }
  | { type: "toggle"; key: string; label: string };

export type FilterValues = Record<string, string[] | string | boolean | undefined>;
