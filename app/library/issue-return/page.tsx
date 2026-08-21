"use client";

// Issue / Return desk (Phase 9N) — real PostgreSQL/API cutover. Server-
// authoritative circulation: no fake success, no client-computed due dates
// beyond the real LibraryPolicy default.
import { useMemo, useState } from "react";
import { BookMarked, ScanLine } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStudentList } from "@/lib/hooks/api/use-students";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { issueLoanRequest, returnLoanRequest, useLibraryCopies, useLibraryLoans } from "@/lib/hooks/api/use-library-api";
import { roleLabels } from "@/lib/permissions/roles";
import { formatDate } from "@/lib/utils";

export default function IssueReturnPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();

  const [borrowerType, setBorrowerType] = useState<"student" | "staff">("student");
  const [borrowerId, setBorrowerId] = useState("");
  const [copyQuery, setCopyQuery] = useState("");
  const [copyId, setCopyId] = useState("");
  const [issueError, setIssueError] = useState<string | null>(null);
  const [issueSuccess, setIssueSuccess] = useState<string | null>(null);

  const [returnQuery, setReturnQuery] = useState("");

  const { data: students } = useStudentList({ status: ["active"], pageSize: 150 });
  const { data: staff } = useStaffList({ status: "active", pageSize: 200 });
  const { data: availableCopies } = useLibraryCopies({ status: "available" });
  const { data: issuedLoans, reload: reloadIssued } = useLibraryLoans({ status: "issued" });

  const filteredCopies = useMemo(() => {
    const q = copyQuery.trim().toLowerCase();
    if (!q) return availableCopies.slice(0, 20);
    return availableCopies.filter((c) => c.accessionNumber.toLowerCase().includes(q) || c.bookTitle.toLowerCase().includes(q)).slice(0, 20);
  }, [availableCopies, copyQuery]);

  const filteredLoans = useMemo(() => {
    const q = returnQuery.trim().toLowerCase();
    if (!q) return issuedLoans.slice(0, 20);
    return issuedLoans.filter((l) => l.accessionNumber.toLowerCase().includes(q) || l.bookTitle.toLowerCase().includes(q) || l.borrowerName.toLowerCase().includes(q)).slice(0, 20);
  }, [issuedLoans, returnQuery]);

  if (!capabilitiesLoading && !hasServerPermission("library.manage")) {
    return <PermissionDenied action="issue or return library books" role={roleLabels[role]} backHref="/library" />;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Issue / Return</h1>
        <p className="text-xs text-muted-foreground">Fast circulation desk</p>
      </div>

      <div className="grid grid-cols-1 gap-md lg:grid-cols-2">
        <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <ScanLine className="size-4" /> Issue
          </h2>
          {issueError && <p className="text-xs text-error">{issueError}</p>}
          {issueSuccess && <p className="text-xs text-success">{issueSuccess}</p>}

          <div>
            <Label>Borrower type</Label>
            <Select value={borrowerType} onValueChange={(v) => { setBorrowerType(v as "student" | "staff"); setBorrowerId(""); }}>
              <SelectTrigger aria-label="Borrower type"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="student">Student</SelectItem>
                <SelectItem value="staff">Staff</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Borrower</Label>
            <Select value={borrowerId} onValueChange={setBorrowerId}>
              <SelectTrigger aria-label="Borrower"><SelectValue placeholder="Select borrower" /></SelectTrigger>
              <SelectContent>
                {borrowerType === "student"
                  ? students.map((s) => <SelectItem key={s.id} value={s.id}>{s.fullName}</SelectItem>)
                  : staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="copy-search">Book (accession or title)</Label>
            <Input id="copy-search" value={copyQuery} onChange={(e) => { setCopyQuery(e.target.value); setCopyId(""); }} placeholder="Search available copies" />
          </div>
          {copyQuery && (
            <div className="flex max-h-40 flex-col divide-y divide-border overflow-y-auto rounded-md border border-border">
              {filteredCopies.map((c) => (
                <button
                  key={c.id} type="button" onClick={() => { setCopyId(c.id); setCopyQuery(`${c.bookTitle} (${c.accessionNumber})`); }}
                  className={`p-sm text-left text-sm hover:bg-surface-2 ${copyId === c.id ? "bg-primary/10" : ""}`}
                >
                  <p className="text-foreground">{c.bookTitle}</p>
                  <p className="text-xs text-muted-foreground">{c.accessionNumber}</p>
                </button>
              ))}
              {filteredCopies.length === 0 && <p className="p-sm text-xs text-muted-foreground">No available copies match</p>}
            </div>
          )}
          <Button
            disabled={!borrowerId || !copyId}
            onClick={async () => {
              setIssueError(null); setIssueSuccess(null);
              const res = await issueLoanRequest({ copyId, ...(borrowerType === "student" ? { studentId: borrowerId } : { staffId: borrowerId }) });
              if (!res.success) { setIssueError(res.error.message); return; }
              setIssueSuccess(`Issued — due ${formatDate(res.data.dueAt)}`);
              setBorrowerId(""); setCopyId(""); setCopyQuery("");
              reloadIssued();
            }}
          >
            Issue book
          </Button>
        </section>

        <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
          <h2 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            <BookMarked className="size-4" /> Return
          </h2>
          <div>
            <Label htmlFor="return-search">Search issued loans</Label>
            <Input id="return-search" value={returnQuery} onChange={(e) => setReturnQuery(e.target.value)} placeholder="Accession, title or borrower" />
          </div>
          <div className="flex flex-col divide-y divide-border rounded-md border border-border">
            {filteredLoans.map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-sm p-sm">
                <div className="min-w-0">
                  <p className="truncate text-sm text-foreground">{l.bookTitle}</p>
                  <p className="text-xs text-muted-foreground">{l.borrowerName} · {l.accessionNumber}</p>
                </div>
                <div className="flex shrink-0 items-center gap-xs">
                  {l.isOverdue && <Badge tone="error">{l.daysOverdue}d overdue</Badge>}
                  <Button size="sm" variant="outline" onClick={async () => { await returnLoanRequest(l.id); reloadIssued(); }}>Return</Button>
                </div>
              </div>
            ))}
            {filteredLoans.length === 0 && <p className="p-sm text-center text-xs text-muted-foreground">No issued loans match</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
