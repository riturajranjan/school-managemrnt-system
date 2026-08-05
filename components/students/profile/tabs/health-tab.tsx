import { HeartPulse } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { Student } from "@/lib/types/students";
import { formatDate } from "@/lib/utils";

export function HealthTab({ student }: { student: Student }) {
  const { health } = student;
  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs flex items-center gap-1 text-sm font-semibold text-foreground">
            <HeartPulse className="size-4 text-error" /> Medical summary
          </h3>
          <dl className="grid grid-cols-2 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Blood group</dt>
            <dd className="text-foreground">{health.bloodGroup ?? "—"}</dd>
            <dt className="text-muted-foreground">Last checkup</dt>
            <dd className="text-foreground">{health.lastCheckup ? formatDate(health.lastCheckup) : "—"}</dd>
            <dt className="text-muted-foreground">Physician</dt>
            <dd className="text-foreground">{health.physicianName ?? "—"}</dd>
          </dl>
        </div>
        <div className="rounded-lg border border-border p-sm">
          <h3 className="mb-xs text-sm font-semibold text-foreground">Emergency contact</h3>
          <p className="text-sm text-foreground">{health.emergencyContactName}</p>
          <p className="text-xs text-muted-foreground">{health.emergencyContactPhone}</p>
        </div>
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h3 className="mb-xs text-sm font-semibold text-foreground">Allergies & conditions</h3>
        <div className="flex flex-wrap gap-1">
          {health.allergies.length === 0 && health.conditions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No known allergies or conditions.</p>
          ) : (
            <>
              {health.allergies.map((a) => (
                <Badge key={a} tone="warning">
                  Allergy: {a}
                </Badge>
              ))}
              {health.conditions.map((c) => (
                <Badge key={c} tone="info">
                  {c}
                </Badge>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
