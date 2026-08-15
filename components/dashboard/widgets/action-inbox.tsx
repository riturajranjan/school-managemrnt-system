"use client";

// Phase 9A: deferred (lowest priority per phase scope — no new cross-domain
// workflow engine). The old mock spanned leave/admission/fee-concession/
// certificate/result-publication/purchase approvals; most of those domains
// aren't real yet, and the ones that are (e.g. Admissions) already have their
// own real approval flow on their own pages — a generic inbox aggregator
// would be new product surface, not a mock-data swap. See DeferredWidget.
import { Inbox } from "lucide-react";
import { DeferredWidget } from "./deferred-widget";

export function ActionInboxWidget() {
  return <DeferredWidget title="Action Inbox" icon={Inbox} message="A cross-module action inbox is not available yet — use each module's own approval flow." />;
}
