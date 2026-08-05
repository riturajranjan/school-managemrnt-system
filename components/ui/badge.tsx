import type { HTMLAttributes } from "react";
import { toneClasses } from "@/components/dashboard/tone";
import type { StatusTone } from "@/lib/types/common";
import { cn } from "@/lib/utils";

export function Badge({
  tone = "neutral",
  className,
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: StatusTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-xs font-medium",
        toneClasses[tone].soft,
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function Dot({ tone = "neutral", className }: { tone?: StatusTone; className?: string }) {
  return <span className={cn("size-1.5 shrink-0 rounded-pill", toneClasses[tone].dot, className)} aria-hidden="true" />;
}
