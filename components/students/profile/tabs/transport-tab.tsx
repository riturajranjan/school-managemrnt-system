"use client";

import { Bus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { transportRoutes } from "@/lib/data/seed/reference";
import { bulkAssignTransport } from "@/lib/services/students-service";
import type { Student } from "@/lib/types/students";
import { useState } from "react";

export function TransportTab({ student }: { student: Student }) {
  const { can } = usePermissions();
  const [routeId, setRouteId] = useState(student.transport?.routeId ?? transportRoutes[0].id);

  if (!student.transport) {
    return (
      <div className="flex flex-col items-start gap-sm rounded-lg border border-dashed border-border p-md">
        <Bus className="size-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">This student doesn&apos;t use school transport.</p>
        {can("students.edit") && (
          <div className="flex items-center gap-xs">
            <Select value={routeId} onValueChange={setRouteId}>
              <SelectTrigger className="w-48" aria-label="Route">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {transportRoutes.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              size="sm"
              onClick={() => {
                const route = transportRoutes.find((r) => r.id === routeId)!;
                bulkAssignTransport([student.id], route.id, route.name, "Administrator");
              }}
            >
              Assign route
            </Button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-md">
      <div className="flex items-center gap-sm">
        <Bus className="size-5 text-info" />
        <div>
          <p className="text-sm font-medium text-foreground">{student.transport.routeName}</p>
          <p className="text-xs text-muted-foreground">Stop: {student.transport.stopName}</p>
        </div>
      </div>
      <dl className="mt-sm grid grid-cols-2 gap-y-1 text-sm">
        <dt className="text-muted-foreground">Pickup</dt>
        <dd className="text-foreground">{student.transport.pickupTime}</dd>
        <dt className="text-muted-foreground">Drop</dt>
        <dd className="text-foreground">{student.transport.dropTime}</dd>
      </dl>
    </div>
  );
}
