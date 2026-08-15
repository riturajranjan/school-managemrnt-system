"use client";

// Phase 9A: deferred. The Transport domain is not real yet — no real
// route/vehicle-tracking model backs a live status widget. See
// DeferredWidget.
import { Bus } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function TransportStatusWidget() {
  return <DeferredWidget title="Transport Status" icon={Bus} message="Transport tracking is not available yet." />;
}
