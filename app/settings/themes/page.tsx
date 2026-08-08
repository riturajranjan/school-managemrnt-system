"use client";

import { useState } from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, SlidersHorizontal, Sun } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useAdmin } from "@/lib/hooks/use-admin";
import { saveTheme } from "@/lib/services/admin-service";
import { roleLabels } from "@/lib/permissions/roles";
import { schoolThemeColors, schoolThemeLabels, type SchoolTheme, type ThemeMode } from "@/lib/types/admin";
import { cn } from "@/lib/utils";

// Rough relative-luminance contrast check (mock, WCAG-style).
function contrastRatio(hex: string, bg: "#ffffff" | "#0b1a24"): number {
  const lum = (h: string) => {
    const c = h.replace("#", ""); const r = parseInt(c.slice(0, 2), 16) / 255, g = parseInt(c.slice(2, 4), 16) / 255, b = parseInt(c.slice(4, 6), 16) / 255;
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
  };
  const l1 = lum(hex), l2 = lum(bg);
  const [hi, lo] = l1 > l2 ? [l1, l2] : [l2, l1];
  return Math.round(((hi + 0.05) / (lo + 0.05)) * 10) / 10;
}

export default function ThemesPage() {
  const { role } = usePermissions();
  const admin = useAdmin();
  const { theme: mode, setTheme } = useTheme();
  const [schoolTheme, setSchoolTheme] = useState<SchoolTheme>(admin.theme.schoolTheme);

  const canManage = role === "super-admin" || role === "administrator";
  if (!canManage) return <PermissionDenied action="manage themes" role={roleLabels[role]} backHref="/settings" />;

  const applySchoolTheme = (t: SchoolTheme) => { setSchoolTheme(t); saveTheme({ mode: (mode as ThemeMode) ?? "system", schoolTheme: t }); };
  const colors = schoolThemeColors[schoolTheme];

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div><h1 className="flex items-center gap-2 text-lg font-semibold text-foreground"><SlidersHorizontal className="size-5 text-primary" /> Theme settings</h1><p className="text-xs text-muted-foreground">Appearance mode and school colour theme</p></div>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Appearance mode</h2>
        <div className="grid grid-cols-3 gap-sm">
          {([["light", Sun], ["dark", Moon], ["system", Monitor]] as const).map(([m, Icon]) => (
            <button key={m} type="button" onClick={() => setTheme(m)} className={cn("flex flex-col items-center gap-1 rounded-lg border p-md transition", mode === m ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}><Icon className="size-5 text-foreground" /><span className="text-sm capitalize text-foreground">{m}</span>{mode === m && <Check className="size-3.5 text-primary" />}</button>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">School theme</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(schoolThemeLabels) as SchoolTheme[]).map((t) => {
            const c = schoolThemeColors[t];
            return (
              <button key={t} type="button" onClick={() => applySchoolTheme(t)} className={cn("flex items-center justify-between gap-2 rounded-lg border p-sm text-left transition", schoolTheme === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/40")}>
                <div className="flex items-center gap-2"><span className="flex gap-0.5">{[c.primary, c.secondary, c.accent].map((col, i) => <span key={i} className="size-4 rounded-full" style={{ background: col }} />)}</span><span className="text-sm font-medium text-foreground">{schoolThemeLabels[t]}</span></div>
                {schoolTheme === t && <Check className="size-4 text-primary" />}
              </button>
            );
          })}
        </div>
        {schoolTheme !== "default" && <p className="mt-sm text-xs text-muted-foreground">The app sidebar keeps its default navy→teal gradient unless overridden in the Branding Studio.</p>}
      </section>

      {/* Contrast checker */}
      <section className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Colour accessibility (mock)</h2>
        <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
          {([["Primary on white", colors.primary, "#ffffff"], ["Primary on dark", colors.primary, "#0b1a24"], ["Secondary on white", colors.secondary, "#ffffff"], ["Accent on dark", colors.accent, "#0b1a24"]] as const).map(([label, fg, bg]) => {
            const ratio = contrastRatio(fg, bg);
            const ok = ratio >= 4.5, aa = ratio >= 3;
            return (
              <div key={label} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
                <span className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded text-[10px] font-bold" style={{ background: bg, color: fg }}>Aa</span>{label}</span>
                <Badge tone={ok ? "success" : aa ? "warning" : "error"}>{ratio}:1 · {ok ? "AA" : aa ? "Large only" : "Low"}</Badge>
              </div>
            );
          })}
        </div>
        <p className="mt-sm text-xs text-muted-foreground">Indicative contrast ratios only — not a substitute for a full accessibility audit.</p>
      </section>
    </div>
  );
}
