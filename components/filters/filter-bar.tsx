"use client";

import { ListFilter, Search, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { FilterFieldConfig, FilterValues } from "./types";

function countActive(
  fields: FilterFieldConfig[],
  values: FilterValues,
): number {
  let count = 0;
  for (const field of fields) {
    const value = values[field.key];
    if (field.type === "toggle") {
      if (value) count += 1;
    } else if (Array.isArray(value)) {
      count += value.length;
    } else if (typeof value === "string" && value) {
      count += 1;
    }
  }
  return count;
}

export function FilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = "Search…",
  fields,
  values,
  onChange,
  onClearAll,
  trailingActions,
}: {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  fields: FilterFieldConfig[];
  values: FilterValues;
  onChange: (
    key: string,
    value: string[] | string | boolean | undefined,
  ) => void;
  onClearAll: () => void;
  trailingActions?: ReactNode;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const activeCount = countActive(fields, values);

  function toggleMultiValue(key: string, option: string) {
    const current = (values[key] as string[] | undefined) ?? [];
    const next = current.includes(option)
      ? current.filter((v) => v !== option)
      : [...current, option];
    onChange(key, next);
  }

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex flex-wrap items-center gap-sm">
        <div className="relative min-w-0 flex-1 sm:">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={searchPlaceholder}
            className="pl-9"
            aria-label={searchPlaceholder}
          />
        </div>

        <Button
          variant="outline"
          onClick={() => setSheetOpen(true)}
          className="relative">
          <ListFilter className="size-4" aria-hidden="true" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 flex size-4 items-center justify-center rounded-pill bg-primary text-[10px] font-semibold text-primary-foreground">
              {activeCount}
            </span>
          )}
        </Button>

        {trailingActions}
      </div>

      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-xs">
          {fields.flatMap((field) => {
            const value = values[field.key];
            if (field.type === "toggle") {
              if (!value) return [];
              return [
                <FilterChip
                  key={field.key}
                  label={field.label}
                  onRemove={() => onChange(field.key, false)}
                />,
              ];
            }
            if (Array.isArray(value)) {
              return value.map((v) => {
                const option = field.options.find((o) => o.value === v);
                return (
                  <FilterChip
                    key={`${field.key}-${v}`}
                    label={option?.label ?? v}
                    onRemove={() => toggleMultiValue(field.key, v)}
                  />
                );
              });
            }
            if (typeof value === "string" && value) {
              const option =
                field.type === "select"
                  ? field.options.find((o) => o.value === value)
                  : undefined;
              return [
                <FilterChip
                  key={field.key}
                  label={option?.label ?? value}
                  onRemove={() => onChange(field.key, undefined)}
                />,
              ];
            }
            return [];
          })}
          <button
            type="button"
            onClick={onClearAll}
            className="text-xs font-medium text-primary underline-offset-2 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring rounded-sm">
            Clear all
          </button>
        </div>
      )}

      <DetailDrawer
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        title="Filters"
        description="Refine the list below">
        <div className="flex flex-col gap-lg">
          {fields.map((field) => (
            <div key={field.key}>
              <Label className="text-sm font-semibold text-foreground">
                {field.label}
              </Label>
              {field.type === "toggle" ? (
                <div className="mt-xs flex items-center justify-between rounded-md border border-border px-sm py-sm">
                  <span className="text-sm text-foreground">{field.label}</span>
                  <Switch
                    checked={Boolean(values[field.key])}
                    onCheckedChange={(checked) => onChange(field.key, checked)}
                  />
                </div>
              ) : field.type === "select" ? (
                <div className="mt-xs flex flex-col gap-1">
                  {field.options.map((option) => (
                    <label
                      key={option.value}
                      className="flex min-h-9 cursor-pointer items-center gap-sm rounded-md px-sm text-sm text-foreground hover:bg-surface-secondary">
                      <input
                        type="radio"
                        name={field.key}
                        className="size-4 accent-primary"
                        checked={values[field.key] === option.value}
                        onChange={() => onChange(field.key, option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              ) : (
                <div className="mt-xs flex flex-col gap-1">
                  {field.options.map((option) => {
                    const checked = (
                      (values[field.key] as string[] | undefined) ?? []
                    ).includes(option.value);
                    return (
                      <label
                        key={option.value}
                        className="flex min-h-9 cursor-pointer items-center gap-sm rounded-md px-sm text-sm text-foreground hover:bg-surface-secondary">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            toggleMultiValue(field.key, option.value)
                          }
                        />
                        {option.label}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-lg flex gap-sm">
          <Button variant="outline" className="flex-1" onClick={onClearAll}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={() => setSheetOpen(false)}>
            Show results
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}

function FilterChip({
  label,
  onRemove,
}: {
  label: string;
  onRemove: () => void;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill bg-surface-secondary py-1 pl-sm pr-1 text-xs font-medium text-foreground",
      )}>
      {label}
      <button
        type="button"
        onClick={onRemove}
        className="flex size-4 items-center justify-center rounded-pill text-muted-foreground outline-none transition-colors hover:bg-border hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Remove ${label} filter`}>
        <X className="size-3" />
      </button>
    </span>
  );
}
