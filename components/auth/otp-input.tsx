"use client";

import { useRef, type ClipboardEvent, type KeyboardEvent } from "react";

/** 6-digit OTP input: auto-advance, backspace navigation, paste support,
 * numeric mobile keyboard, one-time-code autofill. Frontend only — never
 * triggers a real OTP. */
export function OtpInput({ length = 6, value, onChange }: { length?: number; value: string; onChange: (v: string) => void }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = value.padEnd(length).slice(0, length).split("");

  const setDigit = (i: number, d: string) => {
    const arr = value.padEnd(length).split("");
    arr[i] = d;
    onChange(arr.join("").trimEnd());
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onKeyDown = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i]?.trim() && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
    if (e.key === "ArrowRight" && i < length - 1) refs.current[i + 1]?.focus();
  };

  const onPaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (text) { onChange(text); refs.current[Math.min(text.length, length - 1)]?.focus(); }
  };

  return (
    <div className="flex justify-between gap-1.5 sm:gap-2" role="group" aria-label="One-time code">
      {Array.from({ length }).map((_, i) => (
        <input
          key={i} ref={(el) => { refs.current[i] = el; }}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={1}
          aria-label={`Digit ${i + 1}`} value={digits[i]?.trim() ?? ""}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, "").slice(-1))}
          onKeyDown={(e) => onKeyDown(i, e)} onPaste={onPaste}
          className="size-11 min-w-0 flex-1 rounded-md border border-border bg-surface text-center text-lg font-semibold text-foreground outline-none focus:border-primary sm:size-12"
        />
      ))}
    </div>
  );
}
