import Link from "next/link";
import { ChevronRight } from "lucide-react";

// Small in-page trail for Fees sub-pages nested under a hub (Fee Setup,
// Student Fees, …) — the global header breadcrumb only ever shows
// "Operations > Fees" for anything under /fees/*, so deeper pages need this
// for orientation (UX audit — see /fees redesign).
export function FeeTrail({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Fees trail" className="flex items-center gap-1 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="size-3 shrink-0" aria-hidden="true" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground hover:underline">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
