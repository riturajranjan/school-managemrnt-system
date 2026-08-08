import type { LucideIcon } from "lucide-react";
import {
  Blocks, Building2, CalendarRange, Database, FileText, FlaskConical, Globe, Hash, IdCard, KeyRound,
  Languages, LayoutGrid, ListChecks, Lock, Mail, Network, Palette, Plug, ScrollText, Server, ShieldCheck,
  Sliders, SlidersHorizontal, Tags, Users, Workflow,
} from "lucide-react";

export type SettingsNavItem = { label: string; href: string; icon: LucideIcon; keywords?: string[] };
export type SettingsNavCategory = { key: string; label: string; icon: LucideIcon; items: SettingsNavItem[] };

export const settingsNav: SettingsNavCategory[] = [
  {
    key: "organization", label: "Organization", icon: Building2, items: [
      { label: "General", href: "/settings/general", icon: Sliders, keywords: ["overview", "preferences"] },
      { label: "School Profile", href: "/settings/school", icon: Building2, keywords: ["name", "board", "affiliation", "logo"] },
      { label: "Branches", href: "/settings/branches", icon: Network, keywords: ["campus", "wing"] },
    ],
  },
  {
    key: "academics", label: "Academics", icon: CalendarRange, items: [
      { label: "Academic Sessions", href: "/settings/academic-sessions", icon: CalendarRange, keywords: ["year", "session"] },
      { label: "Academic Structure", href: "/settings/academic-structure", icon: LayoutGrid, keywords: ["class", "section", "subject"] },
    ],
  },
  {
    key: "access", label: "Users & Access", icon: Users, items: [
      { label: "Users", href: "/settings/users", icon: Users, keywords: ["accounts", "access"] },
      { label: "Roles", href: "/settings/roles", icon: ShieldCheck, keywords: ["role"] },
      { label: "Permissions", href: "/settings/permissions", icon: KeyRound, keywords: ["matrix", "rbac"] },
      { label: "Access Scopes", href: "/settings/access", icon: Lock, keywords: ["scope", "branch"] },
      { label: "Approval Workflows", href: "/settings/workflows", icon: Workflow, keywords: ["approval", "leave", "concession"] },
    ],
  },
  {
    key: "customization", label: "Customization", icon: Tags, items: [
      { label: "Custom Fields", href: "/settings/custom-fields", icon: ListChecks, keywords: ["field"] },
      { label: "Custom Statuses", href: "/settings/statuses", icon: Tags, keywords: ["status"] },
    ],
  },
  {
    key: "branding", label: "Branding", icon: Palette, items: [
      { label: "Branding Studio", href: "/settings/branding", icon: Palette, keywords: ["logo", "colour", "color"] },
      { label: "Themes", href: "/settings/themes", icon: SlidersHorizontal, keywords: ["dark", "light", "theme"] },
    ],
  },
  {
    key: "localization", label: "Localization", icon: Globe, items: [
      { label: "Localization", href: "/settings/localization", icon: Globe, keywords: ["locale", "format"] },
      { label: "Languages", href: "/settings/languages", icon: Languages, keywords: ["hindi", "english"] },
      { label: "Regional", href: "/settings/regional", icon: Globe, keywords: ["country", "timezone", "currency"] },
      { label: "Numbering", href: "/settings/numbering", icon: Hash, keywords: ["receipt", "invoice", "admission", "sequence"] },
    ],
  },
  {
    key: "communication", label: "Communication", icon: Mail, items: [
      { label: "Notifications", href: "/settings/notifications", icon: Mail, keywords: ["parent", "channel", "sms", "email"] },
      { label: "Communication", href: "/settings/communication", icon: Mail, keywords: ["sender", "quiet hours"] },
      { label: "Integrations", href: "/settings/integrations", icon: Plug, keywords: ["razorpay", "whatsapp", "gps", "provider"] },
    ],
  },
  {
    key: "modules", label: "Modules", icon: Blocks, items: [
      { label: "Modules", href: "/settings/modules", icon: Blocks, keywords: ["visibility", "enable"] },
      { label: "Features", href: "/settings/features", icon: FlaskConical, keywords: ["flag", "beta"] },
    ],
  },
  {
    key: "security", label: "Security", icon: ShieldCheck, items: [
      { label: "Security", href: "/settings/security", icon: Lock, keywords: ["password", "2fa", "session"] },
      { label: "Audit Log", href: "/settings/audit-log", icon: ScrollText, keywords: ["activity", "log"] },
    ],
  },
  {
    key: "data", label: "Data & System", icon: Database, items: [
      { label: "Data Centre", href: "/settings/data", icon: Database, keywords: ["storage", "retention"] },
      { label: "Import / Export", href: "/settings/import-export", icon: IdCard, keywords: ["csv", "import", "export"] },
      { label: "Backups", href: "/settings/backups", icon: Server, keywords: ["restore", "backup"] },
      { label: "System Health", href: "/settings/system-health", icon: Server, keywords: ["status", "uptime"] },
      { label: "Policies", href: "/settings/policies", icon: FileText, keywords: ["policy"] },
      { label: "Privacy", href: "/settings/privacy", icon: FileText, keywords: ["privacy", "consent"] },
      { label: "Terms", href: "/settings/terms", icon: FileText, keywords: ["terms"] },
    ],
  },
];

export const allSettingsItems = settingsNav.flatMap((c) => c.items.map((i) => ({ ...i, category: c.label })));
