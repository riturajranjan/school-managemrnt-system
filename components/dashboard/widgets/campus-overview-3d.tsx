"use client";

// Phase 9A: deferred. Campus zone occupancy has no real tracking model — this
// was a fabricated isometric visualization. See DeferredWidget.
import { Building2 } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function CampusOverview3DWidget() {
  return <DeferredWidget title="3D Campus Overview" icon={Building2} message="Campus zone occupancy tracking is not available yet." />;
}
