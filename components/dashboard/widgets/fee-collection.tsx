"use client";

// Phase 9A: deferred. The Fees domain is not real yet — no real Invoice/
// Payment model backs a school-side fee-collection summary. See
// DeferredWidget.
import { Wallet } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function FeeCollectionWidget() {
  return <DeferredWidget title="Fee Collection" icon={Wallet} message="Fee collection data is not available yet." />;
}
