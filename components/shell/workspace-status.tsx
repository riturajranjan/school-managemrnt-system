// Decorative sync/connectivity indicator — no real backend to reflect yet.
export function WorkspaceStatus() {
  return (
    <div className="flex items-center gap-xs px-sm text-xs text-sidebar-foreground/55">
      <span className="relative flex size-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
      </span>
      <span className="truncate">All changes synced</span>
    </div>
  );
}
