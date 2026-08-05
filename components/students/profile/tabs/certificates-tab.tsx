"use client";

import { FileBadge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { generateCertificate } from "@/lib/services/students-service";
import type { Student } from "@/lib/types/students";
import { downloadTextFile, formatDateTime } from "@/lib/utils";

const CERTIFICATE_TYPES = ["Bonafide certificate", "Transfer certificate", "Character certificate", "Fee-paid certificate"];

export function CertificatesTab({ student }: { student: Student }) {
  const certificates = student.timeline.filter((e) => e.category === "certificate");

  function generate(type: string) {
    generateCertificate(student.id, type, "Administrator");
    downloadTextFile(
      `${student.admissionNumber}-${type.toLowerCase().replace(/\s+/g, "-")}.txt`,
      `${type}\n\nThis certifies that ${student.profile.firstName} ${student.profile.lastName} (Admission No. ${student.admissionNumber}) is a student of Novyra International, currently enrolled for session ${student.session}.\n\nIssued on ${new Date().toLocaleDateString("en-IN")}.`,
      "text/plain",
    );
  }

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-wrap gap-xs">
        {CERTIFICATE_TYPES.map((type) => (
          <Button key={type} variant="outline" size="sm" onClick={() => generate(type)}>
            <FileBadge className="size-3.5" />
            Generate {type}
          </Button>
        ))}
      </div>

      {certificates.length === 0 ? (
        <p className="text-sm text-muted-foreground">No certificates generated yet.</p>
      ) : (
        <ol className="flex flex-col gap-sm">
          {certificates.map((c) => (
            <li key={c.id} className="flex items-center justify-between rounded-md border border-border p-sm text-sm">
              <span className="text-foreground">{c.title}</span>
              <span className="text-xs text-muted-foreground">{formatDateTime(c.createdAt)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
