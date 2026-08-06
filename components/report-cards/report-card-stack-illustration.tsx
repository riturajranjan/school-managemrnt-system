// Lightweight CSS-only "stack of report cards" — three layered, slightly offset and
// rotated rounded rectangles with an inner rule pattern, evoking printed documents
// without an image asset or WebGL. Purely decorative (aria-hidden).
export function ReportCardStackIllustration() {
  return (
    <div aria-hidden="true" className="relative mx-auto h-24 w-28 shrink-0">
      <div className="absolute inset-x-3 top-4 h-20 rotate-[-8deg] rounded-lg border border-border bg-surface-secondary/70 shadow-card" />
      <div className="absolute inset-x-2 top-2 h-20 rotate-[6deg] rounded-lg border border-border bg-surface-secondary shadow-card" />
      <div className="surface-3d absolute inset-x-0 top-0 flex h-20 flex-col gap-1.5 rounded-lg border border-border bg-surface px-3 py-2.5">
        <div className="h-1.5 w-3/5 rounded-full bg-primary/40" />
        <div className="h-1 w-full rounded-full bg-border" />
        <div className="h-1 w-4/5 rounded-full bg-border" />
        <div className="h-1 w-full rounded-full bg-border" />
        <div className="mt-auto flex items-center justify-between">
          <div className="h-3 w-3 rounded-full border-2 border-success/60" />
          <div className="h-1 w-6 rounded-full bg-border" />
        </div>
      </div>
    </div>
  );
}
