"use client";

// Phase 9A: deferred. Staff Attendance/Leave stay on the mock store (Phase
// 5B scope) — no real check-in/substitute-requirement model exists yet. See
// DeferredWidget.
import { Users } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function StaffAvailabilityWidget() {
  return <DeferredWidget title="Staff Availability" icon={Users} message="Staff attendance is not available yet." />;
}
