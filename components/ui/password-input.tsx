"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "./input";

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(({ className, ...props }, ref) => {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={cn("pr-9", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
});
PasswordInput.displayName = "PasswordInput";

// Mirrors the REAL server-side rule (lib/server/auth/password-setup.ts
// passwordStrengthSchema: 8+ chars, a letter, a number) plus non-blocking
// bonus signals (length, case mix, symbols) for a richer visual hint. Never
// used for validation itself — only the server's zod schema is authoritative.
export function passwordStrength(value: string): { score: 0 | 1 | 2 | 3 | 4; label: string; meetsPolicy: boolean } {
  const meetsPolicy = value.length >= 8 && /[A-Za-z]/.test(value) && /[0-9]/.test(value);
  if (!value) return { score: 0, label: "", meetsPolicy: false };
  let score = 0;
  if (value.length >= 8) score++;
  if (value.length >= 12) score++;
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++;
  if (/[0-9]/.test(value) && /[^A-Za-z0-9]/.test(value)) score++;
  const clamped = Math.min(4, Math.max(meetsPolicy ? 1 : 0, score)) as 0 | 1 | 2 | 3 | 4;
  const labels = ["Too short", "Weak", "Fair", "Good", "Strong"];
  return { score: clamped, meetsPolicy, label: labels[clamped] };
}

export function PasswordStrengthMeter({ value }: { value: string }) {
  const { score, label, meetsPolicy } = passwordStrength(value);
  if (!value) return null;
  const tone = score <= 1 ? "bg-error" : score === 2 ? "bg-warning" : "bg-success";
  return (
    <div className="mt-1 flex items-center gap-2">
      <div className="flex flex-1 gap-1">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors", i < score ? tone : "bg-border")} />
        ))}
      </div>
      <span className={cn("text-[11px] font-medium", meetsPolicy ? "text-muted-foreground" : "text-error")}>{label}</span>
    </div>
  );
}
