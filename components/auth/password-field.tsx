"use client";

import { useId, useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

/** Accessible password input with a visibility toggle. Passes through
 * autocomplete so browser password managers work. */
export function PasswordField({ label = "Password", value, onChange, autoComplete = "current-password", error, describedBy, placeholder }: {
  label?: string; value: string; onChange: (v: string) => void; autoComplete?: string; error?: string; describedBy?: string; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  const id = useId();
  const errId = `${id}-err`;
  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <input
          id={id} type={show ? "text" : "password"} value={value} onChange={(e) => onChange(e.target.value)} autoComplete={autoComplete} placeholder={placeholder}
          aria-invalid={Boolean(error)} aria-describedby={cn(error && errId, describedBy) || undefined}
          className={cn("w-full rounded-md border bg-surface py-2 pl-3 pr-10 text-sm text-foreground outline-none focus:border-primary", error ? "border-error" : "border-border")}
        />
        <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:text-foreground">
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error && <p id={errId} className="mt-1 text-xs text-error">{error}</p>}
    </div>
  );
}
