// Decorative sync/connectivity indicator — no real backend to reflect yet.
export function WorkspaceStatus() {
  return (
    <div className="flex items-center gap-xs px-1 pb-0.5 text-xs text-sidebar-text-faint">
      <span className="relative flex size-1.5 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sidebar-success/60 motion-reduce:animate-none" />
        <span className="relative inline-flex size-1.5 rounded-full bg-sidebar-success shadow-[0_0_4px_var(--sidebar-success)]" />
      </span>
      <span className="truncate">All changes synced</span>
    </div>
  );
}
