"use client";

// This page was a mock (useSisStore) vendor list. A real Vendor system
// already exists under Accounting (Production Accounting checkpoint), with a
// full real UI at /accounting/vendors (GET/POST/PATCH /api/accounting/
// vendors, accounting.view/accounting.manage). Redirect there rather than
// build a second, parallel vendor registry.
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function InventoryVendorsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/accounting/vendors");
  }, [router]);
  return <div className="py-2xl text-center text-sm text-muted-foreground">Redirecting to Vendors…</div>;
}
