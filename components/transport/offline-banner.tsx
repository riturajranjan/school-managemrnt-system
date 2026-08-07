import { CloudOff, RefreshCw } from "lucide-react";

export function OfflineBanner({ online, pendingCount }: { online: boolean; pendingCount: number }) {
  if (online && pendingCount === 0) return null;

  return (
    <div className={`flex items-center gap-xs rounded-lg border p-sm text-xs ${online ? "border-success/30 bg-success/8 text-success" : "border-warning/30 bg-warning/8 text-warning"}`}>
      {online ? <RefreshCw className="size-3.5" /> : <CloudOff className="size-3.5" />}
      {online ? `Back online — syncing ${pendingCount} queued action(s)` : `Offline — ${pendingCount} action(s) recorded and waiting to sync`}
    </div>
  );
}
