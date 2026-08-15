import type { LucideIcon } from "lucide-react";
import { WidgetShell } from "../widget-shell";

/**
 * Phase 9A: an honest "not available yet" state for a dashboard widget whose
 * domain has no real backend (Fees, Staff Attendance, Transport, or a
 * composite/AI-generated summary spanning them). Keeps the widget's title,
 * icon and grid position — never fabricates data to fill the space. No fetch:
 * there is nothing real to load.
 */
export function DeferredWidget({ title, icon, message }: { title: string; icon: LucideIcon; message: string }) {
  return (
    <WidgetShell title={title} icon={icon} status="ready" isEmpty emptyMessage={message}>
      <></>
    </WidgetShell>
  );
}
