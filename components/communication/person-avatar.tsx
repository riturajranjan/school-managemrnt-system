import { cn } from "@/lib/utils";

/** Dimensional initials avatar for a communication participant (single name). */
export function PersonAvatar({ name, color = "#18b0c8", size = "md", className }: { name: string; color?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dim = size === "lg" ? "size-12 text-base" : size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  const initials = name.split(" ").slice(0, 2).map((p) => p.charAt(0)).join("").toUpperCase();
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-card", dim, className)}
      style={{ background: `radial-gradient(circle at 32% 28%, ${color}ee, ${color}99 70%, ${color}cc 100%)` }}
      aria-hidden="true"
    >
      <span className="pointer-events-none absolute inset-0 rounded-full bg-white/15" style={{ maskImage: "radial-gradient(circle at 32% 25%, black, transparent 55%)" }} />
      {initials}
    </span>
  );
}
