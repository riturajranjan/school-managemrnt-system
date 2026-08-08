"use client";

import { Check, ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type SelectCardProps = { onClick: () => void; selected?: boolean; disabled?: boolean; children: React.ReactNode };

/** Generic selectable card used by school / role / branch / child / session
 * selectors. Keyboard accessible (it's a <button>). */
export function SelectCard({ onClick, selected, disabled, children }: SelectCardProps) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={selected}
      className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", disabled ? "cursor-not-allowed border-border opacity-50" : selected ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-surface hover:border-primary/40 hover:shadow-sm")}>
      {children}
      {selected ? <Check className="ml-auto size-4 shrink-0 text-primary" /> : !disabled && <ChevronRight className="ml-auto size-4 shrink-0 text-muted-foreground" />}
    </button>
  );
}

export function Avatar({ text, color, className }: { text: string; color: string; className?: string }) {
  return <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white", className)} style={{ background: color }}>{text}</span>;
}

export { Badge as SelectorBadge };
