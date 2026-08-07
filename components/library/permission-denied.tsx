import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared permission-denied state for Phase 7 pages. Never rely on hidden
 * buttons alone — routes and actions render this when the current role lacks
 * the required permission. */
export function PermissionDenied({
  action,
  role,
  backHref = "/library",
}: {
  action: string;
  role: string;
  backHref?: string;
}) {
  return (
    <div className="mx-auto flex  flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
      <span className="flex size-12 items-center justify-center rounded-pill bg-error/10 text-error">
        <ShieldAlert className="size-6" aria-hidden="true" />
      </span>
      <h1 className="text-base font-semibold text-foreground">
        Permission required
      </h1>
      <p className="text-sm text-muted-foreground">
        Your role ({role}) does not have permission to {action}. Contact an
        administrator if you need access.
      </p>
      <Button asChild size="sm" variant="outline">
        <Link href={backHref}>Back to Library</Link>
      </Button>
    </div>
  );
}
