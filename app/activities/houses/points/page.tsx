"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { awardHousePoints } from "@/lib/services/activities-service";
import { roleLabels } from "@/lib/permissions/roles";
import { housePointReasonLabels } from "@/lib/types/activities";
import type { HousePointReason } from "@/lib/types/activities";
import { formatDate } from "@/lib/utils";

export default function HousePointsPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const [, force] = useState(0);
  const [houseId, setHouseId] = useState(db.houses[0]?.id ?? "");
  const [points, setPoints] = useState(10);
  const [reason, setReason] = useState<HousePointReason>("special-recognition");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  const recent = useMemo(
    () =>
      [...db.housePoints]
        .sort((a, b) => b.awardedAt.localeCompare(a.awardedAt))
        .slice(0, 10),
    [db.housePoints],
  );
  const houseName = (hid: string) =>
    db.houses.find((h) => h.id === hid)?.name ?? hid;

  if (!can("activities.awardPoints"))
    return (
      <PermissionDenied
        action="award house points"
        role={roleLabels[role]}
        backHref="/activities/houses"
      />
    );

  const submit = () => {
    const r = awardHousePoints({
      houseId,
      points,
      reason,
      description,
      awardedBy: roleLabels[role],
      awardedByRole: roleLabels[role],
    });
    if (!r.ok) {
      setError(r.error);
      setOk(false);
      return;
    }
    setError(null);
    setOk(true);
    setDescription("");
    force((n) => n + 1);
  };

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/activities/houses">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Award house points
          </h1>
          <p className="text-xs text-muted-foreground">
            Every award is recorded in an append-only audit trail.
          </p>
        </div>
      </div>

      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-2 gap-sm">
          <div>
            <Label>House</Label>
            <Select value={houseId} onValueChange={setHouseId}>
              <SelectTrigger aria-label="House">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {db.houses.map((h) => (
                  <SelectItem key={h.id} value={h.id}>
                    {h.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="pts">Points (+/–)</Label>
            <Input
              id="pts"
              type="number"
              value={points}
              onChange={(e) => setPoints(Number(e.target.value))}
            />
          </div>
        </div>
        <div>
          <Label>Reason</Label>
          <Select
            value={reason}
            onValueChange={(v) => setReason(v as HousePointReason)}>
            <SelectTrigger aria-label="Reason">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(housePointReasonLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor="desc">Description (for the audit trail)</Label>
          <Textarea
            id="desc"
            value={description}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
              setDescription(e.target.value)
            }
            rows={2}
            placeholder="Why are these points being awarded?"
          />
        </div>
        {error && (
          <p className="rounded-md border border-error/30 bg-error/8 p-sm text-xs text-error">
            {error}
          </p>
        )}
        {ok && (
          <p className="rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success">
            Points recorded and standings updated.
          </p>
        )}
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={submit}
            disabled={!houseId || points === 0 || !description.trim()}>
            Award points
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">
          Recent awards
        </h2>
        <div className="flex flex-col gap-xs">
          {recent.map((e) => (
            <div
              key={e.id}
              className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-sm">
              <div className="min-w-0">
                <p className="truncate text-foreground">
                  {houseName(e.houseId)} · {housePointReasonLabels[e.reason]}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {e.description} · {formatDate(e.awardedAt.slice(0, 10))}
                </p>
              </div>
              <span
                className={`text-sm font-semibold tabular-nums ${e.points >= 0 ? "text-success" : "text-error"}`}>
                {e.points >= 0 ? "+" : ""}
                {e.points}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
