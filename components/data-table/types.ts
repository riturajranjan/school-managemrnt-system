import type { ReactNode } from "react";

export type ColumnAlign = "left" | "right" | "center";

export type ColumnDef<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortValue?: (row: T) => string | number;
  align?: ColumnAlign;
  width?: string;
  /** Hidden from the column-visibility menu (always shown, e.g. the primary identity column). */
  alwaysVisible?: boolean;
  defaultVisible?: boolean;
};

export type RowAction<T> = {
  key: string;
  label: string;
  icon?: ReactNode;
  onSelect: (row: T) => void;
  destructive?: boolean;
  hidden?: (row: T) => boolean;
};
