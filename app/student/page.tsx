"use client";

// Phase 9W.2 — Student account foundation. This is deliberately NOT a student
// portal: no academic/attendance/fees/library/etc. data is surfaced here. It
// exists only so a real, provisioned Student login resolves to something
// honest instead of the staff-oriented main dashboard (which assumes a Staff
// profile) or a fabricated feature set. Reads GET /api/me/student-profile,
// which resolves the real Student record by Student.userId === caller —
// identity-scoped, not permission-scoped (the STUDENT role holds zero
// permissions by design). A full student portal is a future phase.
//
// User Account Creation Foundation review — the one real capability this
// page DOES offer: "Add / Invite My Guardian" (POST /api/me/guardian). It is
// deliberately restricted — no role picker, no student-id field, no browsing
// other guardians. The server resolves the caller's own Student record; a
// student can only ever add a guardian to themselves.
import { useState } from "react";
import { GraduationCap, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useApiResource } from "@/lib/hooks/api/use-api";
import { apiPost } from "@/lib/api/client";

type MyStudentProfile = {
  id: string;
  name: string;
  admissionNumber: string;
  classLabel: string | null;
  sectionLabel: string | null;
  status: string;
};

function AddGuardianForm() {
  const [open, setOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [relation, setRelation] = useState<"father" | "mother" | "guardian">("guardian");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ passwordSetupUrl: string | null } | null>(null);

  async function submit(invite: boolean) {
    setError(null);
    if (!firstName.trim() || !lastName.trim()) return setError("First and last name are required.");
    if (invite && !email.trim()) return setError("An email is required to invite your guardian to set up a login.");
    setBusy(true);
    const res = await apiPost<{ guardianId: string; passwordSetupUrl: string | null }>("/api/me/guardian", {
      guardian: { firstName: firstName.trim(), lastName: lastName.trim(), email: email.trim() || undefined, phone: phone.trim() || undefined },
      relation,
      invite,
    });
    setBusy(false);
    if (!res.success) return setError(res.error.message);
    setResult({ passwordSetupUrl: res.data.passwordSetupUrl });
  }

  if (result) {
    return (
      <div className="mt-md w-full rounded-lg border border-border bg-surface p-md text-left text-sm">
        <p className="font-medium text-foreground">Guardian added.</p>
        {result.passwordSetupUrl ? (
          <>
            <p className="mt-1 text-muted-foreground">Share this secure one-time setup link with them so they can create their own login:</p>
            <code className="mt-1 block break-all rounded bg-muted px-2 py-1 text-xs">{result.passwordSetupUrl}</code>
          </>
        ) : (
          <p className="mt-1 text-muted-foreground">No login was requested — they can be invited later.</p>
        )}
        <Button size="sm" variant="outline" className="mt-sm" onClick={() => { setResult(null); setOpen(false); setFirstName(""); setLastName(""); setEmail(""); setPhone(""); }}>Done</Button>
      </div>
    );
  }

  if (!open) {
    return (
      <Button size="sm" variant="outline" className="mt-md" onClick={() => setOpen(true)}>
        <UserPlus className="size-3.5" /> Add / invite my guardian
      </Button>
    );
  }

  return (
    <div className="mt-md flex w-full flex-col gap-sm rounded-lg border border-border bg-surface p-md text-left">
      <p className="text-sm font-medium text-foreground">Add my guardian</p>
      <div className="grid grid-cols-2 gap-sm">
        <div><Label htmlFor="g-first">First name</Label><Input id="g-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} /></div>
        <div><Label htmlFor="g-last">Last name</Label><Input id="g-last" value={lastName} onChange={(e) => setLastName(e.target.value)} /></div>
      </div>
      <div>
        <Label>Relation</Label>
        <Select value={relation} onValueChange={(v) => setRelation(v as typeof relation)}>
          <SelectTrigger aria-label="Relation"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="father">Father</SelectItem>
            <SelectItem value="mother">Mother</SelectItem>
            <SelectItem value="guardian">Guardian</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div><Label htmlFor="g-email">Email (required to invite a login)</Label><Input id="g-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><Label htmlFor="g-phone">Phone (optional)</Label><Input id="g-phone" value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
      {error && <p className="text-sm text-error">{error}</p>}
      <div className="flex gap-xs">
        <Button size="sm" disabled={busy} onClick={() => submit(false)}>Add only</Button>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => submit(true)}>Add &amp; invite login</Button>
        <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
      </div>
    </div>
  );
}

export default function StudentAccountFoundationPage() {
  const { data, loading, error } = useApiResource<MyStudentProfile>(
    "/api/me/student-profile",
  );

  return (
    <div className="mx-auto flex flex-col items-center gap-md px-md py-3xl text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <GraduationCap className="size-6" />
      </span>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading your account…</p>
      ) : error ? (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            Account not linked
          </h1>
          <p className="text-sm text-muted-foreground">{error}</p>
        </>
      ) : (
        <>
          <h1 className="text-lg font-semibold text-foreground">
            Welcome, {data?.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Admission No. {data?.admissionNumber}
            {data?.classLabel
              ? ` · ${data.classLabel}${data.sectionLabel ? ` ${data.sectionLabel}` : ""}`
              : ""}
          </p>

          <AddGuardianForm />

          <div className="mt-md rounded-lg border border-dashed border-border bg-surface px-md py-md text-sm text-muted-foreground">
            Your account is set up and this is a real login — but the student
            portal (grades, homework, attendance, fees) is not built yet. It is
            a planned future phase, not something this page fakes.
          </div>
        </>
      )}
    </div>
  );
}
