"use client";

import Link from "next/link";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useExams } from "@/lib/hooks/use-exams";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatDateTime } from "@/lib/utils";

export default function ResultPublicationHubPage() {
  const db = useSisStore();
  const exams = useExams();

  const publications = db.resultPublications
    .map((p) => ({ ...p, exam: exams.find((e) => e.id === p.examId) }))
    .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Result publication</h1>
        <p className="text-xs text-muted-foreground">Every publication and revocation across exams</p>
      </div>

      <div className="flex flex-col gap-1">
        {publications.map((p) => (
          <Link
            key={p.id}
            href={`/exams/${p.examId}/publish`}
            className="surface-3d flex items-center justify-between gap-sm rounded-lg border border-border bg-surface p-sm outline-none transition-colors [@media(hover:hover)]:hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{p.exam?.name ?? p.examId}</p>
              <p className="text-xs text-muted-foreground">
                {p.status === "published" && p.publishedAt ? `Published ${formatDateTime(p.publishedAt)} by ${p.publishedBy}` : p.status === "scheduled" ? `Scheduled for ${p.publishAt}` : `Revoked${p.revokedAt ? ` ${formatDateTime(p.revokedAt)}` : ""}`}
              </p>
            </div>
            <Badge tone={p.status === "published" ? "success" : p.status === "scheduled" ? "info" : "error"}>
              {p.status === "published" ? <CheckCircle2 className="size-3" /> : p.status === "scheduled" ? <Clock className="size-3" /> : <XCircle className="size-3" />}
              {p.status}
            </Badge>
          </Link>
        ))}
        {publications.length === 0 && <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No results have been published yet.</p>}
      </div>
    </div>
  );
}
