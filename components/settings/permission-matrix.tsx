"use client";

import { useMemo, useState } from "react";
import { Check, Minus, Search, X } from "lucide-react";
import {
  matrixActions,
  matrixModules,
  roleCan,
} from "@/lib/selectors/admin-brief";
import { roleLabels, type UserRole } from "@/lib/permissions/roles";
import { cn } from "@/lib/utils";

function Cell({ state }: { state: "yes" | "no" | "na" }) {
  if (state === "na")
    return (
      <span className="text-muted-foreground" aria-label="Not applicable">
        <Minus className="mx-auto size-3.5" />
      </span>
    );
  if (state === "yes")
    return (
      <span className="text-success" aria-label="Allowed">
        <Check className="mx-auto size-4" />
      </span>
    );
  return (
    <span className="text-error/60" aria-label="Denied">
      <X className="mx-auto size-3.5" />
    </span>
  );
}

/** Permission matrix. Desktop = sticky-header table (module rows × action cols),
 * mobile = per-module cards with switch-style states. Reads the REAL role
 * permissions via `roleCan`, so it reflects actual gating (read-only view). */
export function PermissionMatrix({ role }: { role: UserRole }) {
  const [query, setQuery] = useState("");
  const modules = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? matrixModules.filter((m) => m.label.toLowerCase().includes(q))
      : matrixModules;
  }, [query]);

  return (
    <div className="flex flex-col gap-sm">
      <div className="flex items-center justify-between gap-sm">
        <div className="relative  flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter modules…"
            aria-label="Filter modules"
            className="w-full rounded-md border border-border bg-surface py-1.5 pl-8 pr-3 text-sm text-foreground outline-none focus:border-primary"
          />
        </div>
        <span className="text-xs text-muted-foreground">
          Viewing:{" "}
          <span className="font-medium text-foreground">
            {roleLabels[role]}
          </span>
        </span>
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto rounded-lg border border-border sm:block">
        <table className="w-full min-w-max text-sm">
          <thead className="sticky top-0">
            <tr className="border-b border-border bg-surface-secondary/60 text-xs text-muted-foreground">
              <th className="sticky left-0 z-10 bg-surface-secondary/60 px-sm py-2 text-left">
                Module
              </th>
              {matrixActions.map((a) => (
                <th key={a} className="px-sm py-2 text-center capitalize">
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modules.map((m) => (
              <tr
                key={m.id}
                className="border-b border-border/60 hover:bg-surface-secondary/30">
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-surface px-sm py-2 text-left font-medium text-foreground">
                  {m.label}
                </th>
                {matrixActions.map((a) => (
                  <td key={a} className="px-sm py-2 text-center">
                    <Cell state={roleCan(role, m.id, a)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-xs sm:hidden">
        {modules.map((m) => (
          <div
            key={m.id}
            className="rounded-lg border border-border bg-surface p-sm">
            <p className="mb-1 text-sm font-medium text-foreground">
              {m.label}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {matrixActions.map((a) => {
                const state = roleCan(role, m.id, a);
                if (state === "na") return null;
                return (
                  <span
                    key={a}
                    className={cn(
                      "flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] capitalize",
                      state === "yes"
                        ? "bg-success/10 text-success"
                        : "bg-surface-secondary text-muted-foreground line-through",
                    )}>
                    {a}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        <Check className="mr-1 inline size-3 text-success" />
        allowed · <X className="mx-1 inline size-3 text-error/60" />
        denied · <Minus className="mx-1 inline size-3" />
        not applicable. Matrix reflects the app&apos;s real role gating
        (read-only).
      </p>
    </div>
  );
}
