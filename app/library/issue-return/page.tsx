"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, BookMarked, CheckCircle2, ScanLine, Search, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { checkLoanEligibility, issueLoan, returnLoan } from "@/lib/services/loan-service";
import { matchLoanRule, overdueDays } from "@/lib/selectors/library-loan-rules";
import { roleLabels } from "@/lib/permissions/roles";
import { loanStatusLabels } from "@/lib/types/library";
import { formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/finance/money";

type Mode = "issue" | "return";

export default function IssueReturnPage() {
  const db = useSisStore();
  const { can, role } = usePermissions();
  const actor = { name: "Circulation Desk", role: roleLabels[role] };
  const today = new Date().toISOString().slice(0, 10);

  const [mode, setMode] = useState<Mode>("issue");
  const [memberQuery, setMemberQuery] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [copyQuery, setCopyQuery] = useState("");
  const [returnQuery, setReturnQuery] = useState("");
  const [flash, setFlash] = useState<{ tone: "success" | "error"; text: string } | null>(null);

  const member = db.libraryMembers.find((m) => m.id === selectedMemberId);

  const memberMatches = useMemo(() => {
    const q = memberQuery.trim().toLowerCase();
    if (!q) return [];
    return db.libraryMembers.filter((m) => m.name.toLowerCase().includes(q) || m.membershipId.toLowerCase().includes(q) || m.cardBarcode.toLowerCase().includes(q)).slice(0, 6);
  }, [db.libraryMembers, memberQuery]);

  const copyMatches = useMemo(() => {
    const q = copyQuery.trim().toLowerCase();
    if (!q) return [];
    return db.bookCopies.filter((c) => c.barcode.toLowerCase().includes(q) || c.accessionNumber.toLowerCase().includes(q)).slice(0, 6);
  }, [db.bookCopies, copyQuery]);

  const returnMatches = useMemo(() => {
    const q = returnQuery.trim().toLowerCase();
    if (!q) return [];
    const copyIds = db.bookCopies.filter((c) => c.barcode.toLowerCase().includes(q) || c.accessionNumber.toLowerCase().includes(q)).map((c) => c.id);
    return db.libraryLoans.filter((l) => (l.status === "active" || l.status === "overdue" || l.status === "renewed") && copyIds.includes(l.copyId)).slice(0, 6);
  }, [db.bookCopies, db.libraryLoans, returnQuery]);

  if (!can("library.circulate")) return <PermissionDenied action="run the circulation desk" role={roleLabels[role]} />;

  const activeLoans = member ? db.libraryLoans.filter((l) => l.memberId === member.id && (l.status === "active" || l.status === "overdue" || l.status === "renewed")) : [];
  const memberFines = member ? db.libraryFines.filter((f) => f.memberId === member.id && (f.status === "pending" || f.status === "partially-paid")) : [];

  function doIssue(copyId: string) {
    if (!member) return;
    const result = issueLoan({ memberId: member.id, copyId }, actor, today);
    if (result.ok) {
      setFlash({ tone: "success", text: `Issued. Due ${formatDate(result.loan.dueDate)}.` });
      setCopyQuery("");
    } else {
      setFlash({ tone: "error", text: result.error });
    }
  }

  function doReturn(loanId: string) {
    const result = returnLoan({ loanId }, actor, today);
    if (result.ok) {
      setFlash({ tone: "success", text: result.fine ? `Returned — ${formatMoney(result.fine.amount)} fine generated.` : "Returned. No fine." });
      setReturnQuery("");
    } else {
      setFlash({ tone: "error", text: result.error });
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Circulation desk</h1>
          <p className="text-xs text-muted-foreground">Keyboard-first issue and return · scan a barcode or type to search</p>
        </div>
        <div className="inline-flex rounded-md border border-border p-0.5" role="tablist" aria-label="Circulation mode">
          <button role="tab" aria-selected={mode === "issue"} onClick={() => { setMode("issue"); setFlash(null); }} className={`rounded px-sm py-1.5 text-sm font-medium ${mode === "issue" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            Issue
          </button>
          <button role="tab" aria-selected={mode === "return"} onClick={() => { setMode("return"); setFlash(null); }} className={`rounded px-sm py-1.5 text-sm font-medium ${mode === "return" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
            Return
          </button>
        </div>
      </div>

      {flash && (
        <div className={`flex items-center gap-sm rounded-md border p-sm text-sm ${flash.tone === "success" ? "border-success/30 bg-success/8 text-success" : "border-error/30 bg-error/8 text-error"}`} role="status">
          {flash.tone === "success" ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
          {flash.text}
        </div>
      )}

      {mode === "issue" ? (
        <>
          {/* Step 1 — member */}
          <section className="rounded-lg border border-border bg-surface p-md">
            <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
              <UserRound className="size-4" /> 1 · Member
            </h2>
            {member ? (
              <div className="flex items-center justify-between gap-sm">
                <div>
                  <p className="text-sm font-medium text-foreground">{member.name}</p>
                  <p className="text-xs text-muted-foreground">{member.membershipId} · {member.classOrDept ?? member.type}</p>
                </div>
                <div className="flex items-center gap-xs">
                  <Badge tone={member.status === "active" ? "success" : "error"}>{member.status}</Badge>
                  <Button size="sm" variant="ghost" onClick={() => { setSelectedMemberId(null); setMemberQuery(""); }}>Change</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-xs">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input autoFocus value={memberQuery} onChange={(e) => setMemberQuery(e.target.value)} placeholder="Scan card or search name / membership ID…" className="pl-8" aria-label="Find member" />
                </div>
                {memberMatches.map((m) => (
                  <button key={m.id} onClick={() => setSelectedMemberId(m.id)} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm text-left hover:border-primary/40">
                    <span>
                      <span className="block text-sm font-medium text-foreground">{m.name}</span>
                      <span className="block text-xs text-muted-foreground">{m.membershipId} · {m.type}</span>
                    </span>
                    <Badge tone={m.status === "active" ? "success" : "error"}>{m.status}</Badge>
                  </button>
                ))}
              </div>
            )}
          </section>

          {member && (
            <>
              {/* Eligibility */}
              <section className="rounded-lg border border-border bg-surface p-md">
                <h2 className="mb-sm text-sm font-semibold text-foreground">2 · Eligibility</h2>
                <div className="grid grid-cols-3 gap-sm text-center">
                  <Stat label="On loan" value={String(activeLoans.length)} />
                  <Stat label="Overdue" value={String(activeLoans.filter((l) => l.status === "overdue" || l.dueDate < today).length)} tone={activeLoans.some((l) => l.dueDate < today) ? "text-warning" : undefined} />
                  <Stat label="Unpaid fines" value={String(memberFines.length)} tone={memberFines.length > 0 ? "text-warning" : undefined} />
                </div>
              </section>

              {/* Step 3 — copy */}
              <section className="rounded-lg border border-border bg-surface p-md">
                <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
                  <ScanLine className="size-4" /> 3 · Scan book copy
                </h2>
                <div className="relative mb-xs">
                  <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={copyQuery} onChange={(e) => setCopyQuery(e.target.value)} placeholder="Scan or type copy barcode / accession…" className="pl-8" aria-label="Find copy" />
                </div>
                <div className="flex flex-col gap-xs">
                  {copyMatches.map((c) => {
                    const book = db.books.find((b) => b.id === c.bookId);
                    const elig = checkLoanEligibility(db, member, c, book, today);
                    return (
                      <div key={c.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">{book?.title ?? c.bookId}</p>
                          <p className="text-xs text-muted-foreground">{c.accessionNumber} · {c.barcode}</p>
                          {!elig.ok && <p className="text-xs text-error">{elig.error}</p>}
                          {elig.ok && elig.warnings.length > 0 && <p className="text-xs text-warning">{elig.warnings.join(" ")}</p>}
                        </div>
                        <Button size="sm" disabled={!elig.ok} onClick={() => doIssue(c.id)}>
                          Issue
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </>
      ) : (
        /* Return mode */
        <section className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
            <BookMarked className="size-4" /> Scan returned book
          </h2>
          <div className="relative mb-sm">
            <ScanLine className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input autoFocus value={returnQuery} onChange={(e) => setReturnQuery(e.target.value)} placeholder="Scan or type copy barcode / accession…" className="pl-8" aria-label="Find loan to return" />
          </div>
          <div className="flex flex-col gap-xs">
            {returnQuery.trim() && returnMatches.length === 0 && <p className="text-sm text-muted-foreground">No active loan matches that copy.</p>}
            {returnMatches.map((loan) => {
              const copy = db.bookCopies.find((c) => c.id === loan.copyId);
              const book = db.books.find((b) => b.id === loan.bookId);
              const m = db.libraryMembers.find((mm) => mm.id === loan.memberId);
              const rule = matchLoanRule(db.libraryRules, { memberType: m?.type ?? "student", resourceType: book?.referenceOnly ? "reference" : "book", categoryId: book?.categoryId });
              const days = rule ? overdueDays(loan.dueDate, today, rule.gracePeriodDays) : 0;
              return (
                <div key={loan.id} className="flex items-center justify-between gap-sm rounded-md border border-border p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{book?.title ?? loan.bookId}</p>
                    <p className="text-xs text-muted-foreground">{m?.name} · {copy?.accessionNumber} · Due {formatDate(loan.dueDate)}</p>
                    {days > 0 ? <p className="text-xs text-warning">{days} day(s) overdue — a fine will be raised</p> : <Badge tone="success">{loanStatusLabels[loan.status]}</Badge>}
                  </div>
                  <Button size="sm" onClick={() => doReturn(loan.id)}>Return</Button>
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border p-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}
