"use client";

// Staff Documents (Production migration, Phase B, HR Sub-batch 2) — real
// PostgreSQL/API cutover. hr.view/hr.manage RBAC — no new permission. UI
// hiding of "Upload document" is defense in depth only: the create endpoint
// (app/api/hr/documents/route.ts) independently re-checks hr.manage,
// tenant/school scope, and the target Staff belongs to this school.
//
// STORAGE GAP: no binary/object storage integration exists in this codebase
// (same as the Phase 9M TransportDocument precedent). This records document
// METADATA only — there is no real file upload. That is disclosed plainly
// below rather than simulated.
import { useState } from "react";
import { Plus, ScrollText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { setStaffDocumentStatusRequest, uploadStaffDocumentRequest, useStaffDocuments } from "@/lib/hooks/api/use-hr-api";
import { useStaffList } from "@/lib/hooks/api/use-staff-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { StaffDocumentDto, StaffDocumentTypeDto, StaffDocumentVisibilityDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const typeLabels: Record<StaffDocumentTypeDto, string> = {
  "id-proof": "ID proof",
  "tax-id": "Tax ID",
  qualification: "Qualification",
  "experience-certificate": "Experience certificate",
  "appointment-letter": "Appointment letter",
  contract: "Contract",
  license: "License",
  "background-check": "Background check",
  "medical-fitness": "Medical fitness",
  "training-certificate": "Training certificate",
  custom: "Custom document",
};

const statusTone: Record<StaffDocumentDto["status"], "success" | "warning" | "error" | "neutral" | "info"> = {
  uploaded: "info",
  verified: "success",
  rejected: "error",
  archived: "neutral",
};

const visibilityLabels: Record<StaffDocumentVisibilityDto, string> = { "hr-only": "HR only", "staff-visible": "Visible to employee" };

export default function StaffDocumentsPage() {
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const { data: documents, loading, error, reload } = useStaffDocuments();
  const { data: staff } = useStaffList({ status: "active", pageSize: 500 });
  const [filter, setFilter] = useState<"queue" | "all">("queue");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [staffId, setStaffId] = useState("");
  const [type, setType] = useState<StaffDocumentTypeDto>("id-proof");
  const [title, setTitle] = useState("");
  const [visibility, setVisibility] = useState<StaffDocumentVisibilityDto>("hr-only");
  const [externalReference, setExternalReference] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  if (!capabilitiesLoading && !hasServerPermission("hr.view") && !hasServerPermission("hr.manage")) {
    return <PermissionDenied action="view staff documents" role={roleLabels[role]} backHref="/hr" />;
  }
  // Real permission, independently re-checked by the upload endpoint — this
  // gate is UX only, never the sole authorization boundary.
  const canManage = hasServerPermission("hr.manage");

  const queue = documents.filter((d) => d.status === "uploaded" || d.isExpired);
  const rows = filter === "queue" ? queue : documents;
  const counts = {
    verified: documents.filter((d) => d.status === "verified").length,
    pending: documents.filter((d) => d.status === "uploaded").length,
    expired: documents.filter((d) => d.isExpired).length,
  };

  function resetForm() {
    setStaffId(""); setType("id-proof"); setTitle(""); setVisibility("hr-only");
    setExternalReference(""); setExpiryDate(""); setNotes(""); setFormError(null);
  }

  async function submit() {
    setFormError(null);
    if (!staffId || !title.trim()) return setFormError("Employee and title are required.");
    const res = await uploadStaffDocumentRequest({
      staffId, type, title: title.trim(), visibility,
      externalReference: externalReference.trim() || undefined,
      expiryDate: expiryDate || undefined,
      notes: notes.trim() || undefined,
    });
    if (!res.success) return setFormError(res.error.message);
    resetForm();
    setUploadOpen(false);
    reload();
  }

  async function setStatus(id: string, status: "verified" | "rejected" | "archived") {
    setBusyId(id);
    await setStaffDocumentStatusRequest(id, status);
    setBusyId(null);
    reload();
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Staff documents</h1>
          <p className="text-xs text-muted-foreground">{counts.verified} verified · {counts.pending} to verify · {counts.expired} expired · metadata only, no file upload</p>
        </div>
        <div className="flex items-center gap-xs">
          <div className="inline-flex rounded-md border border-border p-0.5">
            {(["queue", "all"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={`rounded px-sm py-1.5 text-xs font-medium capitalize ${filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>{f === "queue" ? "Verification queue" : "All"}</button>
            ))}
          </div>
          {/* Real permission gate — the upload endpoint independently re-checks
              hr.manage server-side regardless of this button's visibility. */}
          {canManage && (
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <Plus className="size-3.5" /> Upload document
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load documents: {error}
        </div>
      )}

      {loading && documents.length === 0 ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading documents…</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center gap-sm rounded-lg border border-dashed border-border bg-surface px-md py-2xl text-center">
          <ScrollText className="size-6 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">No documents found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-sm">
          {rows.map((d) => (
            <div key={d.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{d.staffName} <span className="font-normal text-muted-foreground">· {d.title}</span></p>
                <p className="truncate text-xs text-muted-foreground">
                  {typeLabels[d.type]} · {visibilityLabels[d.visibility]}{d.expiryDate ? ` · expires ${formatDate(d.expiryDate)}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-xs">
                {d.isExpired && <Badge tone="error">Expired</Badge>}
                <Badge tone={statusTone[d.status]}>{d.status}</Badge>
                {canManage && d.status === "uploaded" && (
                  <>
                    <Button size="sm" variant="outline" disabled={busyId === d.id} onClick={() => setStatus(d.id, "verified")}>Verify</Button>
                    <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => setStatus(d.id, "rejected")}>Reject</Button>
                  </>
                )}
                {canManage && d.status !== "archived" && (
                  <Button size="sm" variant="ghost" disabled={busyId === d.id} onClick={() => setStatus(d.id, "archived")}>Archive</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canManage && (
        <DetailDrawer
          open={uploadOpen}
          onOpenChange={(o) => { setUploadOpen(o); if (!o) resetForm(); }}
          title="Upload document"
          description="No file storage is integrated yet — this records document metadata only (no binary upload)."
        >
          <div className="flex flex-col gap-sm">
            <div>
              <Label>Employee</Label>
              <Select value={staffId} onValueChange={setStaffId}>
                <SelectTrigger aria-label="Employee"><SelectValue placeholder="Select employee" /></SelectTrigger>
                <SelectContent>{staff.map((s) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Document type</Label>
              <Select value={type} onValueChange={(v) => setType(v as StaffDocumentTypeDto)}>
                <SelectTrigger aria-label="Document type"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(typeLabels) as StaffDocumentTypeDto[]).map((t) => <SelectItem key={t} value={t}>{typeLabels[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-title">Title</Label>
              <Input id="doc-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Aadhaar card" />
            </div>
            <div>
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as StaffDocumentVisibilityDto)}>
                <SelectTrigger aria-label="Visibility"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hr-only">HR only</SelectItem>
                  <SelectItem value="staff-visible">Visible to employee (self-service)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="doc-expiry">Expiry date (optional)</Label>
              <Input id="doc-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="doc-ref">Reference (optional)</Label>
              <Input id="doc-ref" value={externalReference} onChange={(e) => setExternalReference(e.target.value)} placeholder="e.g. physical filing location or external link — no file upload available" />
            </div>
            <div>
              <Label htmlFor="doc-notes">Notes (optional)</Label>
              <Textarea id="doc-notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            {formError && <p className="text-sm text-error">{formError}</p>}
            <Button onClick={submit}>Record document</Button>
          </div>
        </DetailDrawer>
      )}
    </div>
  );
}
