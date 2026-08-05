"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Archive,
  Calendar1,
  CalendarCheck,
  FileBadge,
  MessageSquare,
  MoreHorizontal,
  Pencil,
  Repeat,
  StickyNote,
  Upload,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { findClass, findSection, schoolClasses } from "@/lib/data/seed/reference";
import { archiveStudent, bulkUpdateSection, generateCertificate, markAttendance, recordFeePayment, addStudentNote } from "@/lib/services/students-service";
import type { Student } from "@/lib/types/students";
import { studentStatusLabels } from "@/lib/types/students";
import { downloadTextFile, initialsOf } from "@/lib/utils";
import { studentStatusTone } from "@/components/students/student-meta";

export function StudentHeader({ student, onUploadDocument }: { student: Student; onUploadDocument: () => void }) {
  const { can } = usePermissions();
  const [drawer, setDrawer] = useState<"payment" | "note" | "transfer" | null>(null);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const schoolClass = findClass(student.classId);
  const section = findSection(student.sectionId)?.section;
  const name = `${student.profile.firstName} ${student.profile.lastName}`;

  return (
    <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-start sm:justify-between sm:p-md">
      <div className="flex items-start gap-sm">
        <Avatar className="size-14">
          <AvatarFallback className="text-base">{initialsOf(student.profile.firstName, student.profile.lastName)}</AvatarFallback>
        </Avatar>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-xs">
            <h1 className="text-base font-semibold text-foreground">{name}</h1>
            <Badge tone={studentStatusTone[student.status]}>{studentStatusLabels[student.status]}</Badge>
            {student.profile.house && <Badge tone="info">{student.profile.house} House</Badge>}
          </div>
          <p className="text-xs text-muted-foreground">
            {student.admissionNumber} · Roll {student.rollNumber ?? "—"} · {schoolClass?.name}-{section?.name} · {student.session}
          </p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar1 className="size-3" aria-hidden="true" />
            Admitted {new Date(student.admissionDate).toLocaleDateString("en-IN")}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-xs">
        <Button size="sm" variant="outline" onClick={() => markAttendance(student.id, "present", "Class Teacher")}>
          <CalendarCheck className="size-3.5" />
          Mark present
        </Button>
        {can("students.edit") && (
          <Button asChild size="sm" variant="outline">
            <Link href={`/students/${student.id}/edit`}>
              <Pencil className="size-3.5" />
              Edit
            </Link>
          </Button>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="outline" aria-label="More actions">
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {can("fees.record") && (
              <DropdownMenuItem onSelect={() => setDrawer("payment")}>
                <Wallet className="size-3.5" />
                Record payment
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onSelect={() => setDrawer("note")}>
              <StickyNote className="size-3.5" />
              Add note
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onUploadDocument}>
              <Upload className="size-3.5" />
              Upload document
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                generateCertificate(student.id, "Bonafide certificate", "Administrator");
                downloadTextFile(`${student.admissionNumber}-bonafide-certificate.txt`, `This certifies that ${name} (${student.admissionNumber}) is a bona fide student of Novyra International, currently in ${schoolClass?.name}-${section?.name}.`, "text/plain");
              }}
            >
              <FileBadge className="size-3.5" />
              Generate certificate
            </DropdownMenuItem>
            {can("communication.send") && (
              <DropdownMenuItem onSelect={() => setDrawer("note")}>
                <MessageSquare className="size-3.5" />
                Send message
              </DropdownMenuItem>
            )}
            {can("students.edit") && (
              <DropdownMenuItem onSelect={() => setDrawer("transfer")}>
                <Repeat className="size-3.5" />
                Transfer student
              </DropdownMenuItem>
            )}
            {can("students.archive") && student.status !== "archived" && (
              <DropdownMenuItem onSelect={() => setConfirmArchive(true)} className="text-error">
                <Archive className="size-3.5" />
                Archive student
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <RecordPaymentDrawer open={drawer === "payment"} onOpenChange={(open) => !open && setDrawer(null)} studentId={student.id} />
      <AddNoteDrawer open={drawer === "note"} onOpenChange={(open) => !open && setDrawer(null)} studentId={student.id} />
      <TransferDrawer open={drawer === "transfer"} onOpenChange={(open) => !open && setDrawer(null)} student={student} />

      <ConfirmDialog
        open={confirmArchive}
        onOpenChange={setConfirmArchive}
        title="Archive this student?"
        description="The student will be hidden from active rosters. Their record is preserved and can be restored later."
        confirmLabel="Archive"
        destructive
        onConfirm={() => archiveStudent(student.id, "Administrator")}
      />
    </div>
  );
}

function RecordPaymentDrawer({ open, onOpenChange, studentId }: { open: boolean; onOpenChange: (open: boolean) => void; studentId: string }) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("UPI");
  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Record payment" description="Log a fee payment for this student">
      <div className="flex flex-col gap-sm">
        <div>
          <Label htmlFor="payment-amount">Amount (₹)</Label>
          <Input id="payment-amount" type="number" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <Label>Method</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger aria-label="Payment method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UPI">UPI</SelectItem>
              <SelectItem value="Card">Card</SelectItem>
              <SelectItem value="Cash">Cash</SelectItem>
              <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={!amount || Number(amount) <= 0}
          onClick={() => {
            recordFeePayment(studentId, Number(amount), method, "Accountant");
            setAmount("");
            onOpenChange(false);
          }}
        >
          Record payment
        </Button>
      </div>
    </DetailDrawer>
  );
}

function AddNoteDrawer({ open, onOpenChange, studentId }: { open: boolean; onOpenChange: (open: boolean) => void; studentId: string }) {
  const [body, setBody] = useState("");
  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Add note" description="Adds an entry to this student's timeline">
      <div className="flex flex-col gap-sm">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} placeholder="Write a note…" />
        <Button
          disabled={!body.trim()}
          onClick={() => {
            addStudentNote(studentId, body.trim(), "Staff");
            setBody("");
            onOpenChange(false);
          }}
        >
          Save note
        </Button>
      </div>
    </DetailDrawer>
  );
}

function TransferDrawer({ open, onOpenChange, student }: { open: boolean; onOpenChange: (open: boolean) => void; student: Student }) {
  const [classId, setClassId] = useState(student.classId);
  const [sectionId, setSectionId] = useState(student.sectionId);
  const sections = schoolClasses.find((c) => c.id === classId)?.sections ?? [];

  return (
    <DetailDrawer open={open} onOpenChange={onOpenChange} title="Transfer student" description="Move this student to a different class or section">
      <div className="flex flex-col gap-sm">
        <div>
          <Label>Class</Label>
          <Select value={classId} onValueChange={(v) => { setClassId(v); setSectionId(""); }}>
            <SelectTrigger aria-label="Class">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {schoolClasses.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Section</Label>
          <Select value={sectionId} onValueChange={setSectionId}>
            <SelectTrigger aria-label="Section">
              <SelectValue placeholder="Select section" />
            </SelectTrigger>
            <SelectContent>
              {sections.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  Section {s.name} ({s.enrolledCount}/{s.capacity})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          disabled={!sectionId}
          onClick={() => {
            bulkUpdateSection([student.id], sectionId, classId, "Administrator");
            onOpenChange(false);
          }}
        >
          Transfer
        </Button>
      </div>
    </DetailDrawer>
  );
}
