import { Check, X } from "lucide-react";
import { scorePassword, type PasswordStrength as Strength } from "@/lib/types/auth";

const META: Record<Strength, { label: string; color: string; bars: number }> = {
  weak: { label: "Weak", color: "bg-error", bars: 1 },
  fair: { label: "Fair", color: "bg-warning", bars: 2 },
  good: { label: "Good", color: "bg-info", bars: 3 },
  strong: { label: "Strong", color: "bg-success", bars: 4 },
};

/** Live password-strength meter + requirement checklist. Colour is always
 * paired with a text label for accessibility. */
export function PasswordStrengthMeter({ password }: { password: string }) {
  const { strength, checks } = scorePassword(password);
  const meta = META[strength];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <div className="flex flex-1 gap-1" role="progressbar" aria-valuenow={meta.bars} aria-valuemin={0} aria-valuemax={4} aria-label={`Password strength: ${meta.label}`}>
          {[0, 1, 2, 3].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-pill ${i < meta.bars ? meta.color : "bg-surface-secondary"}`} />)}
        </div>
        {password && <span className="text-xs font-medium text-muted-foreground">{meta.label}</span>}
      </div>
      <ul className="grid grid-cols-1 gap-0.5 sm:grid-cols-2">
        {checks.map((c) => (
          <li key={c.label} className={`flex items-center gap-1 text-[11px] ${c.ok ? "text-success" : "text-muted-foreground"}`}>
            {c.ok ? <Check className="size-3" /> : <X className="size-3" />} {c.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
