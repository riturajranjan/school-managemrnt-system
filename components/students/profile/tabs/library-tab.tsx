import { Library } from "lucide-react";

export function LibraryTab() {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border py-2xl text-center">
      <Library className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm font-medium text-foreground">Library records aren&apos;t connected yet</p>
      <p className="max-w-xs text-xs text-muted-foreground">
        Book issue history and fines will appear here once the Library module ships in a later phase.
      </p>
    </div>
  );
}
