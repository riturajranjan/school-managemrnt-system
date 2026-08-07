import { cn } from "@/lib/utils";

/** A subtle, dimensional book cover built from layered CSS — a spine edge and a
 * soft page block behind the face. No images, no WebGL, theme-aware. Used in
 * the catalogue and book detail as the Phase 7 "book-stack" visual language. */
export function BookCover({ title, color = "#18b0c8", size = "md", className }: { title: string; color?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dims = size === "lg" ? "h-28 w-20" : size === "sm" ? "h-12 w-9" : "h-16 w-12";
  const initials = title.slice(0, 2).toUpperCase();
  return (
    <div className={cn("relative shrink-0", dims, className)} aria-hidden="true">
      {/* page block behind */}
      <div className="absolute inset-0 translate-x-[3px] translate-y-[3px] rounded-sm bg-black/10 dark:bg-white/5" />
      {/* cover face */}
      <div className="absolute inset-0 flex items-end overflow-hidden rounded-sm shadow-card" style={{ background: `linear-gradient(150deg, ${color} 0%, ${color}cc 55%, ${color}99 100%)` }}>
        {/* spine highlight */}
        <div className="absolute inset-y-0 left-0 w-1.5 bg-white/25" />
        <span className="w-full truncate px-1 pb-1 text-[10px] font-bold text-white/90">{initials}</span>
      </div>
    </div>
  );
}

/** A tiny stacked-spines strip used as ambient decoration in the command
 * centre header — dimensional but static, respects reduced motion by design. */
export function BookStack({ colors, className }: { colors: string[]; className?: string }) {
  return (
    <div className={cn("flex items-end gap-[3px]", className)} aria-hidden="true">
      {colors.map((c, i) => (
        <div key={i} className="w-2 rounded-t-[2px] shadow-card" style={{ height: `${14 + ((i * 5) % 16)}px`, background: `linear-gradient(180deg, ${c} 0%, ${c}bb 100%)` }} />
      ))}
    </div>
  );
}
