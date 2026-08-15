"use client";

// Phase 9A: deferred. No real AI-insight generation system exists over the
// school's data — these were fabricated headlines with no real backing. See
// DeferredWidget.
import { Sparkles } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function AiMorningBriefWidget() {
  return <DeferredWidget title="AI Morning Brief" icon={Sparkles} message="AI-generated insights are not available yet." />;
}
