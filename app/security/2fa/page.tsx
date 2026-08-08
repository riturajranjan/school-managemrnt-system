"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, CheckCircle2, ShieldCheck, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { QrToken } from "@/components/documents/qr-token";
import { OtpInput } from "@/components/auth/otp-input";
import { MOCK_RECOVERY_CODES } from "@/lib/types/auth";

const METHODS = [
  {
    key: "app",
    label: "Authenticator app",
    desc: "Time-based codes (TOTP)",
    available: true,
  },
  { key: "sms", label: "SMS", desc: "Text message codes", available: false },
  { key: "email", label: "Email", desc: "Emailed codes", available: false },
];

export default function TwoFactorPage() {
  const [method, setMethod] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/security">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
            <ShieldCheck className="size-5 text-primary" /> Two-step
            verification
          </h1>
          <p className="text-xs text-muted-foreground">
            Frontend UI only · backend security integration required
          </p>
        </div>
      </div>

      {enabled ? (
        <div className="flex flex-col items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-lg text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-success/15 text-success">
            <CheckCircle2 className="size-6" />
          </span>
          <p className="text-sm font-medium text-foreground">
            Two-step verification enabled (simulation)
          </p>
          <p className="text-xs text-muted-foreground">
            Save your recovery codes in case you lose your device.
          </p>
          <div className="flex gap-xs">
            <Button asChild size="sm" variant="outline">
              <Link href="/security/recovery">View recovery codes</Link>
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setEnabled(false);
                setMethod(null);
                setCode("");
              }}>
              Disable
            </Button>
          </div>
        </div>
      ) : !method ? (
        <div className="flex flex-col gap-xs">
          {METHODS.map((m) => (
            <button
              key={m.key}
              type="button"
              disabled={!m.available}
              onClick={() => setMethod(m.key)}
              className={`flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-md text-left transition ${m.available ? "hover:border-primary/40" : "cursor-not-allowed opacity-60"}`}>
              <span className="flex items-center gap-2">
                <Smartphone className="size-4 text-muted-foreground" />
                <span>
                  <span className="block text-sm font-medium text-foreground">
                    {m.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {m.desc}
                  </span>
                </span>
              </span>
              {m.available ? (
                <Badge tone="info">Set up</Badge>
              ) : (
                <Badge tone="neutral">Future integration</Badge>
              )}
            </button>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-md sm:grid-cols-[auto_1fr]">
          <div className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-md">
            <QrToken
              token="NVX-DEMO-2FA-SECRET"
              size={120}
              label="Authenticator setup QR"
            />
            <code className="rounded bg-surface-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
              JBSW-Y3DP-EHPK-3PXP
            </code>
            <p className="text-[10px] text-muted-foreground">
              Obvious demo secret — never a real key
            </p>
          </div>
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
            <p className="text-sm text-foreground">
              Scan the QR in your authenticator app, then enter the 6-digit
              code.
            </p>
            <OtpInput value={code} onChange={setCode} />
            <div className="rounded-md border border-border bg-surface-secondary/40 p-2">
              <p className="mb-1 text-[11px] font-medium text-foreground">
                Recovery codes preview
              </p>
              <div className="grid grid-cols-2 gap-1 font-mono text-[11px] text-muted-foreground">
                {MOCK_RECOVERY_CODES.slice(0, 4).map((c) => (
                  <span key={c}>{c}</span>
                ))}
              </div>
            </div>
            <div className="flex gap-xs">
              <Button size="sm" variant="ghost" onClick={() => setMethod(null)}>
                Back
              </Button>
              <Button
                size="sm"
                onClick={() => setEnabled(true)}
                disabled={code.length < 6}>
                Enable (simulation)
              </Button>
            </div>
          </div>
        </div>
      )}
      <p className="rounded-md border border-warning/30 bg-warning/8 p-sm text-xs text-warning">
        No real 2FA is configured. Enabling here records a preference only —
        enforcement requires a backend.
      </p>
    </div>
  );
}
