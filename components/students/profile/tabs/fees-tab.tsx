import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/stat-tile";
import { feeStructures, findClass } from "@/lib/data/seed/reference";
import type { Student } from "@/lib/types/students";
import { formatCurrency, formatDate } from "@/lib/utils";
import { feeStatusTone } from "@/components/students/student-meta";
import { Wallet } from "lucide-react";

export function FeesTab({ student }: { student: Student }) {
  const { fees } = student;
  const structure = feeStructures.find((f) => f.id === fees.feeStructureId) ?? feeStructures.find((f) => f.classId === student.classId);

  return (
    <div className="flex flex-col gap-md">
      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <StatTile label="Status" value={fees.status} icon={Wallet} tone={feeStatusTone[fees.status]} />
        <StatTile label="Total due" value={formatCurrency(fees.totalDue)} tone="neutral" />
        <StatTile label="Paid" value={formatCurrency(fees.totalPaid)} tone="success" />
        <StatTile label="Overdue" value={formatCurrency(fees.overdueAmount)} tone={fees.overdueAmount > 0 ? "error" : "success"} />
      </div>

      <div className="rounded-lg border border-border p-sm">
        <h3 className="mb-xs text-sm font-semibold text-foreground">Fee structure</h3>
        {structure ? (
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground">
              {structure.name} · {findClass(structure.classId)?.name}
            </span>
            <span className="text-muted-foreground">{structure.installments} installments</span>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No fee structure assigned.</p>
        )}
        {fees.nextDueDate && (
          <p className="mt-1 text-xs text-muted-foreground">
            Next due: <Badge tone="warning">{formatDate(fees.nextDueDate)}</Badge>
          </p>
        )}
      </div>
    </div>
  );
}
