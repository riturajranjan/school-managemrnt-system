"use client";

// Phase 9A: deferred. A composite "School Pulse" score would need Fees,
// Staff Attendance and Transport to be real inputs — none of those domains
// exist yet — so there is nothing honest to compute here. See DeferredWidget.
import { Gauge } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function SchoolPulseWidget() {
  return <DeferredWidget title="School Pulse" icon={Gauge} message="School Pulse needs Fees, Staff Attendance and Transport to be real first — not available yet." />;
}
