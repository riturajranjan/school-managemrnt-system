"use client";

// Borrowers (Phase 9N) — real PostgreSQL/API cutover. No separate
// LibraryMember identity: borrowers are the real Student/Staff directory,
// augmented with their current active-loan count.
import { useMemo, useState } from "react";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { useLibraryLoans } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";

export default function LibraryMembersPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const [search, setSearch] = useState("");

  const { data: students } = useStudentList({ status: ["active"], pageSize: 300 });
  const { data: staff } = useStaffList({ status: "active", pageSize: 300 });
  const { data: issuedLoans } = useLibraryLoans({ status: "issued" });

  const activeCountByBorrower = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of issuedLoans) m.set(l.borrowerId, (m.get(l.borrowerId) ?? 0) + 1);
    return m;
  }, [issuedLoans]);

  const q = search.trim().toLowerCase();
  const filteredStudents = students.filter((s) => !q || s.fullName.toLowerCase().includes(q));
  const filteredStaff = staff.filter((s) => !q || s.name.toLowerCase().includes(q));

  if (!capabilitiesLoading && !hasServerPermission("library.view")) {
    return <PermissionDenied action="view library borrowers" role={roleLabels[role]} backHref="/library" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Borrowers</h1>
        <p className="text-xs text-muted-foreground">Real students and staff — eligibility and current loans</p>
      </div>

      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="max-w-sm" />

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <section className="flex flex-col gap-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Users className="size-4" /> Students</h2>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {filteredStudents.slice(0, 50).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-sm p-sm">
                <p className="truncate text-sm text-foreground">{s.fullName}</p>
                <Badge tone={(activeCountByBorrower.get(s.id) ?? 0) > 0 ? "info" : "neutral"}>{activeCountByBorrower.get(s.id) ?? 0} active</Badge>
              </div>
            ))}
            {filteredStudents.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No students match</p>}
          </div>
        </section>

        <section className="flex flex-col gap-sm">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground"><Users className="size-4" /> Staff</h2>
          <div className="flex flex-col divide-y divide-border rounded-lg border border-border bg-surface">
            {filteredStaff.slice(0, 50).map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-sm p-sm">
                <p className="truncate text-sm text-foreground">{s.name}</p>
                <Badge tone={(activeCountByBorrower.get(s.id) ?? 0) > 0 ? "info" : "neutral"}>{activeCountByBorrower.get(s.id) ?? 0} active</Badge>
              </div>
            ))}
            {filteredStaff.length === 0 && <p className="p-md text-center text-sm text-muted-foreground">No staff match</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
