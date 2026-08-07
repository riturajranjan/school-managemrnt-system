"use client";

import Link from "next/link";
import { use, useState } from "react";
import { ArrowLeft, Boxes, Plus, QrCode } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookCover } from "@/components/library/book-cover";
import { ResourceAuditTrail } from "@/components/library/resource-audit-trail";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useBook, useBookCopies, useLoans, useReservations } from "@/lib/hooks/use-library";
import { useSisStore } from "@/lib/hooks/use-store";
import { availabilityForBook, deriveBookStatus } from "@/lib/selectors/book-availability";
import { recommendationsForMember } from "@/lib/selectors/library-reports";
import { addCopy } from "@/lib/services/book-service";
import { setCopyCondition, withdrawCopy } from "@/lib/services/copy-service";
import { roleLabels } from "@/lib/permissions/roles";
import { bookStatusLabels, copyConditionLabels, copyLoanStatusLabels, loanStatusLabels, reservationStatusLabels, type BookStatus, type CopyCondition } from "@/lib/types/library";
import { formatDate } from "@/lib/utils";
import { formatMoney as fmtMoney } from "@/lib/finance/money";

const statusTone: Record<BookStatus, "success" | "warning" | "error" | "neutral" | "info"> = {
  available: "success",
  limited: "warning",
  "fully-issued": "warning",
  reserved: "info",
  "reference-only": "neutral",
  lost: "error",
  damaged: "error",
  archived: "neutral",
  "digital-only": "info",
};

const conditionTone: Record<CopyCondition, "success" | "warning" | "error" | "neutral"> = {
  new: "success",
  good: "success",
  fair: "neutral",
  worn: "warning",
  damaged: "error",
  lost: "error",
  "under-repair": "warning",
};

export default function BookDetailPage({ params }: { params: Promise<{ bookId: string }> }) {
  const { bookId } = use(params);
  const db = useSisStore();
  const book = useBook(bookId);
  const copies = useBookCopies(bookId);
  const loans = useLoans({ bookId });
  const reservations = useReservations(bookId);
  const { can, role } = usePermissions();
  const canManage = can("library.manageCatalogue");
  const [, force] = useState(0);
  const actor = { name: "Librarian", role: roleLabels[role] };

  if (!can("library.view")) return <PermissionDenied action="view catalogue records" role={roleLabels[role]} />;
  if (!book) {
    return (
      <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Book not found</p>
        <Button asChild size="sm" variant="outline">
          <Link href="/library/catalog">Back to catalogue</Link>
        </Button>
      </div>
    );
  }

  const availability = availabilityForBook(db, book.id);
  const status = deriveBookStatus(book.status, book.referenceOnly, availability);
  const author = db.authors.find((a) => a.id === book.authorId)?.name ?? "Unknown author";
  const category = db.bookCategories.find((c) => c.id === book.categoryId)?.name ?? "Uncategorised";
  const shelf = db.shelves.find((s) => s.id === book.shelfId);
  const digital = db.digitalResources.filter((r) => r.bookId === book.id);
  const memberName = (id: string) => db.libraryMembers.find((m) => m.id === id)?.name ?? id;
  const related = recommendationsForMember(db, db.libraryMembers[0]?.id ?? "", 4).filter((r) => r.book.id !== book.id);

  function handleAddCopy() {
    addCopy({ bookId: book!.id, libraryId: book!.libraryId }, actor);
    force((n) => n + 1);
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back to catalogue">
          <Link href="/library/catalog">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="truncate text-lg font-semibold text-foreground">{book.title}</h1>
          <p className="truncate text-xs text-muted-foreground">{author} · {book.accessionNumber}</p>
        </div>
      </div>

      {/* Header card */}
      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md sm:flex-row">
        <BookCover title={book.title} color={book.coverColor} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-sm">
          <div className="flex flex-wrap items-center gap-xs">
            <Badge tone={statusTone[status]}>{bookStatusLabels[status]}</Badge>
            <Badge tone="neutral">{category}</Badge>
            {book.classRange && <Badge tone="info">Class {book.classRange}</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-sm text-sm sm:grid-cols-4">
            <Metric label="Available" value={`${availability.available}/${availability.total}`} tone={availability.available > 0 ? "text-success" : "text-warning"} />
            <Metric label="Issued" value={String(availability.issued)} />
            <Metric label="Reserved queue" value={String(reservations.filter((r) => r.status === "waiting" || r.status === "ready").length)} />
            <Metric label="Replacement" value={fmtMoney(book.replacementCost)} />
          </div>
          <p className="text-sm text-muted-foreground">{book.description}</p>
          {canManage && (
            <div className="flex flex-wrap gap-xs">
              <Button size="sm" variant="outline" onClick={handleAddCopy}>
                <Plus className="size-3.5" /> Add copy
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/library/barcode?book=${book.id}`}>
                  <QrCode className="size-3.5" /> Print labels
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>

      <Tabs defaultValue="copies">
        <TabsList className="flex-wrap">
          <TabsTrigger value="copies">Copies ({copies.length})</TabsTrigger>
          <TabsTrigger value="loans">Loans ({loans.length})</TabsTrigger>
          <TabsTrigger value="reservations">Reservations ({reservations.length})</TabsTrigger>
          <TabsTrigger value="digital">Digital ({digital.length})</TabsTrigger>
          <TabsTrigger value="related">Related</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="copies" className="mt-md">
          {copies.length === 0 ? (
            <EmptyBlock icon={Boxes} message="No physical copies yet. Add a copy to start lending." />
          ) : (
            <div className="flex flex-col gap-sm">
              {copies.map((copy) => (
                <div key={copy.id} className="flex flex-col gap-xs rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{copy.accessionNumber}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      Barcode {copy.barcode} · {shelf?.label ?? "Unshelved"} · Acquired {formatDate(copy.acquisitionDate)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-xs">
                    <Badge tone={conditionTone[copy.condition]}>{copyConditionLabels[copy.condition]}</Badge>
                    <Badge tone={copy.loanStatus === "on-shelf" ? "success" : copy.loanStatus === "issued" ? "info" : "neutral"}>{copyLoanStatusLabels[copy.loanStatus]}</Badge>
                    {canManage && copy.loanStatus !== "issued" && (
                      <>
                        <Button size="sm" variant="ghost" onClick={() => { setCopyCondition(copy.id, "damaged", actor, "Marked from detail"); force((n) => n + 1); }}>
                          Mark damaged
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setCopyCondition(copy.id, "lost", actor, "Marked from detail"); force((n) => n + 1); }}>
                          Mark lost
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { withdrawCopy(copy.id, actor, "Withdrawn from detail"); force((n) => n + 1); }}>
                          Withdraw
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="loans" className="mt-md">
          {loans.length === 0 ? (
            <EmptyBlock icon={Boxes} message="This title has never been issued." />
          ) : (
            <div className="flex flex-col gap-sm">
              {[...loans].sort((a, b) => b.issuedAt.localeCompare(a.issuedAt)).map((loan) => (
                <div key={loan.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{memberName(loan.memberId)}</p>
                    <p className="text-xs text-muted-foreground">Issued {formatDate(loan.issuedAt)} · Due {formatDate(loan.dueDate)}</p>
                  </div>
                  <Badge tone={loan.status === "overdue" ? "error" : loan.status === "returned" ? "neutral" : "info"}>{loanStatusLabels[loan.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="reservations" className="mt-md">
          {reservations.length === 0 ? (
            <EmptyBlock icon={Boxes} message="No reservations for this title." />
          ) : (
            <div className="flex flex-col gap-sm">
              {[...reservations].sort((a, b) => a.queuePosition - b.queuePosition).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">#{r.queuePosition} · {memberName(r.memberId)}</p>
                    <p className="text-xs text-muted-foreground">Reserved {formatDate(r.reservedAt)}</p>
                  </div>
                  <Badge tone={r.status === "ready" ? "success" : r.status === "waiting" ? "info" : "neutral"}>{reservationStatusLabels[r.status]}</Badge>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="digital" className="mt-md">
          {digital.length === 0 ? (
            <EmptyBlock icon={Boxes} message="No digital version linked to this title." />
          ) : (
            <div className="flex flex-col gap-sm">
              {digital.map((r) => (
                <Link key={r.id} href={`/library/digital`} className="flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
                  <span className="truncate text-sm text-foreground">{r.title}</span>
                  <Badge tone="info">{r.type}</Badge>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="related" className="mt-md">
          {related.length === 0 ? (
            <EmptyBlock icon={Boxes} message="No related titles to suggest yet." />
          ) : (
            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              {related.map(({ book: rb, reason }) => (
                <Link key={rb.id} href={`/library/books/${rb.id}`} className="flex items-center gap-sm rounded-lg border border-border bg-surface p-sm hover:border-primary/40">
                  <BookCover title={rb.title} color={rb.coverColor} size="sm" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">{rb.title}</p>
                    <p className="truncate text-xs text-muted-foreground">{reason}</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="history" className="mt-md">
          <ResourceAuditTrail domain="library" subjectId={book.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? "text-foreground"}`}>{value}</p>
    </div>
  );
}

function EmptyBlock({ icon: Icon, message }: { icon: typeof Boxes; message: string }) {
  return (
    <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-xl text-center">
      <Icon className="size-6 text-muted-foreground" aria-hidden="true" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
