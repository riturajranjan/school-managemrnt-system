import type { LucideIcon } from "lucide-react";
import {
  Activity, Blocks, Building2, CreditCard, Globe, LayoutDashboard, LifeBuoy, Megaphone, Package, Palette,
  Receipt, ScrollText, Server, ShieldCheck, ShoppingBag, Sparkles, TicketCheck, TrendingUp, Users, Wallet,
} from "lucide-react";

export type SaasNavItem = { label: string; href: string; icon: LucideIcon; keywords?: string[] };
export type SaasNavGroup = { key: string; label: string; items: SaasNavItem[] };

export const saasNav: SaasNavGroup[] = [
  {
    key: "overview", label: "Overview", items: [
      { label: "Dashboard", href: "/super-admin", icon: LayoutDashboard },
      { label: "Schools", href: "/super-admin/schools", icon: Building2, keywords: ["tenant", "directory"] },
      { label: "Onboarding", href: "/super-admin/onboarding", icon: Sparkles },
    ],
  },
  {
    key: "revenue", label: "Revenue", items: [
      { label: "Plans", href: "/super-admin/plans", icon: Package },
      { label: "Subscriptions", href: "/super-admin/subscriptions", icon: CreditCard },
      { label: "Trials", href: "/super-admin/trials", icon: TrendingUp },
      { label: "Usage & Limits", href: "/super-admin/usage", icon: Activity },
      { label: "Billing", href: "/super-admin/billing", icon: Wallet },
      { label: "Invoices", href: "/super-admin/invoices", icon: Receipt },
      { label: "Payments", href: "/super-admin/payments", icon: CreditCard },
    ],
  },
  {
    key: "platform", label: "Platform", items: [
      { label: "Features", href: "/super-admin/features", icon: Blocks },
      { label: "Add-ons", href: "/super-admin/addons", icon: Package },
      { label: "Marketplace", href: "/super-admin/marketplace", icon: ShoppingBag },
      { label: "Domains", href: "/super-admin/domains", icon: Globe },
      { label: "Branding", href: "/super-admin/branding", icon: Palette },
    ],
  },
  {
    key: "operations", label: "Operations", items: [
      { label: "Support", href: "/super-admin/support", icon: LifeBuoy },
      { label: "Tenant Health", href: "/super-admin/health", icon: Activity },
      { label: "Activity", href: "/super-admin/activity", icon: ScrollText },
      { label: "Audit Log", href: "/super-admin/audit", icon: TicketCheck },
    ],
  },
  {
    key: "system", label: "System", items: [
      { label: "Announcements", href: "/super-admin/announcements", icon: Megaphone },
      { label: "Status", href: "/super-admin/status", icon: Server },
      { label: "Team", href: "/super-admin/settings", icon: Users },
      { label: "Permissions", href: "/super-admin/permissions", icon: ShieldCheck },
    ],
  },
];

export const allSaasNavItems = saasNav.flatMap((g) => g.items.map((i) => ({ ...i, group: g.label })));
