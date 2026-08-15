"use client";

// Phase 9A: deferred. No real cross-domain exception/anomaly-detection engine
// exists (it spanned attendance/fees/documents/timetable/transport/inventory/
// results — most not real, and building a detection engine over the real ones
// is new product surface, not a mock-data swap). See DeferredWidget.
import { AlertTriangle } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function ExceptionFeedWidget() {
  return <DeferredWidget title="Exception Feed" icon={AlertTriangle} message="Exception detection is not available yet." />;
}
