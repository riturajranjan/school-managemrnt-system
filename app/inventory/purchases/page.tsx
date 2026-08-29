"use client";

// This page was a mock (useSisStore) purchases list. A real Purchase Order
// system already exists — Vendor/PurchaseOrder/PurchaseOrderItem under
// Accounting (Production Accounting checkpoint), with a full real UI at
// /accounting/purchase-orders (GET/POST /api/accounting/purchase-orders,
// approve/cancel workflow, accounting.view/accounting.manage). Redirect
// there rather than build a second, parallel purchase-order system.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InventoryPurchasesRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/accounting/purchase-orders");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Purchase Orders…</div>;
}
