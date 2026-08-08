"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Laptop, MonitorSmartphone, Smartphone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MOCK_TRUSTED_DEVICES } from "@/lib/types/auth";

export default function TrustedDevicesPage() {
  const [devices, setDevices] = useState(MOCK_TRUSTED_DEVICES);
  const iconFor = (d: string) =>
    d.includes("iPhone")
      ? Smartphone
      : d.includes("MacBook")
        ? Laptop
        : MonitorSmartphone;

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
            <MonitorSmartphone className="size-5 text-primary" /> Trusted
            devices
          </h1>
          <p className="text-xs text-muted-foreground">
            Demo data — no real sessions are tracked
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-xs">
        {devices.map((d) => {
          const Icon = iconFor(d.device);
          return (
            <div
              key={d.id}
              className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex size-9 items-center justify-center rounded-md bg-surface-secondary text-muted-foreground">
                  <Icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="flex items-center gap-2 truncate text-sm font-medium text-foreground">
                    {d.device}
                    {d.current && <Badge tone="success">This device</Badge>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {d.browser} · {d.location} · {d.lastActive}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {d.trusted ? (
                  <Badge tone="info">Trusted</Badge>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDevices((list) =>
                        list.map((x) =>
                          x.id === d.id ? { ...x, trusted: true } : x,
                        ),
                      )
                    }>
                    Trust
                  </Button>
                )}
                {!d.current && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      setDevices((list) => list.filter((x) => x.id !== d.id))
                    }>
                    Sign out
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
