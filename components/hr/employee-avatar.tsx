import { cn } from "@/lib/utils";

/** Dimensional initials avatar — colored gradient disc with an inner highlight.
 * No photo storage; the seed assigns each employee a stable `photoColor`. */
export function EmployeeAvatar({ firstName, lastName, color = "#18b0c8", size = "md", className }: { firstName: string; lastName: string; color?: string; size?: "sm" | "md" | "lg"; className?: string }) {
  const dim = size === "lg" ? "size-16 text-lg" : size === "sm" ? "size-8 text-xs" : "size-10 text-sm";
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
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
