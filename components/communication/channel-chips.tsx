import { channelLabels, LIVE_CHANNELS, type CommChannel } from "@/lib/types/communication";
import { cn } from "@/lib/utils";

/** Renders channel chips, clearly distinguishing the one live (in-app) channel
 * from designed-but-not-connected demo channels. Never implies SMS/WhatsApp/
 * email/push are actually connected. */
export function ChannelChips({ channels, className }: { channels: CommChannel[]; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {channels.map((ch) => {
        const live = LIVE_CHANNELS.includes(ch);
        return (
          <span
            key={ch}
            className={cn(
              "inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-medium",
              live ? "bg-success/12 text-success" : "bg-surface-secondary text-muted-foreground",
            )}
            title={live ? "Live channel" : "Demo channel — integration configured later"}
          >
            <span className={cn("size-1.5 rounded-pill", live ? "bg-success" : "bg-muted-foreground/50")} aria-hidden="true" />
            {channelLabels[ch]}
            {!live && <span className="sr-only"> (demo channel, not connected)</span>}
          </span>
        );
      })}
    </div>
  );
}

/** Full channel legend used in composers/settings so users understand which
 * channels are real. */
export function ChannelLegend() {
  return (
    <p className="text-xs text-muted-foreground">
      <span className="font-medium text-success">In-app</span> is live. SMS, WhatsApp, Email and Push are <span className="font-medium">demo channels</span> — designed here, integrations configured in a later phase.
    </p>
  );
}
