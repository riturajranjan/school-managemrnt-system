"use client";

// Real PostgreSQL/API cutover (Phase 9I). Host picker uses the real Staff
// foundation (Phase 6A) — never a mock employee-list host name string. Pass
// number is server-generated (race-safe counter), never Math.random(). The
// QR glyph encodes the real pass number (an opaque identifier already, no
// personal data) — matches the mock's own stated intent.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronRight,
  MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { QrGlyph } from "@/components/library/code-label";
import { CampusMap } from "@/components/communication/campus-map";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useStaff } from "@/lib/hooks/api/use-staff";
import { createWalkInVisitRequest } from "@/lib/hooks/api/use-visitors-api";
import { roleLabels } from "@/lib/permissions/roles";
import type {
  VisitorCategoryDto,
  VisitorVisitDetailDto,
} from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const categoryOptions: { value: VisitorCategoryDto; label: string }[] = [
  { value: "parent", label: "Parent" },
  { value: "vendor", label: "Vendor" },
  { value: "guest", label: "Guest" },
  { value: "contractor", label: "Contractor" },
  { value: "interview_candidate", label: "Interview candidate" },
  { value: "alumni", label: "Alumni" },
  { value: "official", label: "Official" },
  { value: "other", label: "Other" },
];
const departments = [
  "Academics",
  "Administration",
  "Accounts",
  "HR",
  "Principal Office",
  "Library",
];

export default function VisitorCheckInPage() {
  const router = useRouter();
  const { can, role } = usePermissions();
  const { data: staff } = useStaff({ status: "active" });

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [org, setOrg] = useState("");
  const [category, setCategory] = useState<VisitorCategoryDto>("parent");
  const [purpose, setPurpose] = useState("");
  const [hostStaffId, setHostStaffId] = useState("");
  const [department, setDepartment] = useState(departments[0]);
  const [vehicle, setVehicle] = useState("");
  const [visit, setVisit] = useState<VisitorVisitDetailDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!can("visitors.manage"))
    return (
      <PermissionDenied
        action="check in visitors"
        role={roleLabels[role]}
        backHref="/front-desk/visitors"
      />
    );

  async function submit() {
    setError(null);
    if (!name.trim()) return setError("Visitor name is required.");
    if (!hostStaffId) return setError("Select a host to meet.");
    setBusy(true);
    const result = await createWalkInVisitRequest({
      fullName: name.trim(),
      phone: phone.trim(),
      organization: org.trim() || undefined,
      purpose: purpose.trim() || "Visit",
      category,
      department,
      vehicleNumber: vehicle.trim() || undefined,
      hostStaffId,
    });
    setBusy(false);
    if (!result.success) return setError(result.error.message);
    setVisit(result.data);
  }

  const hostName = staff?.find((s) => s.id === hostStaffId)?.name ?? "";

  if (visit) {
    return (
      <div className="mx-auto flex w-full  flex-col gap-md pb-20 sm:pb-0">
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/8 p-sm text-sm text-success">
          <Check className="size-4" /> {visit.visitorName} checked in. Host{" "}
          <span className="font-medium">{visit.hostName}</span> notified
          (in-app).
        </div>
        <div className="mx-auto w-full rounded-xl border border-border bg-surface p-md shadow-floating">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">VISITOR</p>
              <p className="text-sm font-bold text-foreground">
                {visit.visitorName}
              </p>
            </div>
            <BadgeCheck className="size-6 text-primary" />
          </div>
          <div className="flex items-center gap-3">
            <QrGlyph value={visit.passNumber ?? ""} size={72} />
            <div className="text-xs text-muted-foreground">
              <p>
                <span className="text-foreground">Host:</span> {visit.hostName}
              </p>
              <p>
                <span className="text-foreground">Dept:</span>{" "}
                {visit.department ?? "—"}
              </p>
              <p>
                <span className="text-foreground">Date:</span>{" "}
                {formatDate(new Date().toISOString())}
              </p>
              <p className="mt-1 font-mono text-[11px]">{visit.passNumber}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">
            QR encodes the pass number only — no personal data.
          </p>
        </div>
        <div className="flex justify-center gap-xs">
          <Button variant="outline" onClick={() => window.print()}>
            Print badge
          </Button>
          <Button onClick={() => router.push("/front-desk/visitors")}>
            Done
          </Button>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground">
            <MapPin className="size-4" /> Directions to{" "}
            {visit.department ?? "reception"}
          </h2>
          <CampusMap highlight={visit.department ?? ""} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back">
          <Link href="/front-desk/visitors">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">
            Visitor check-in
          </h1>
          <p className="text-xs text-muted-foreground">
            Register the visitor and generate a badge
          </p>
        </div>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vname">Full name *</Label>
            <Input
              id="vname"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vphone">Phone</Label>
            <Input
              id="vphone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+91 …"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Visitor type</Label>
            <Select
              value={category}
              onValueChange={(v) => setCategory(v as VisitorCategoryDto)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((c) => (
                  <SelectItem key={c.value} value={c.value}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vorg">Organization</Label>
            <Input
              id="vorg"
              value={org}
              onChange={(e) => setOrg(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vpurp">Purpose</Label>
            <Input
              id="vpurp"
              value={purpose}
              onChange={(e) => setPurpose(e.target.value)}
              placeholder="e.g. Meet class teacher"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="vveh">Vehicle number</Label>
            <Input
              id="vveh"
              value={vehicle}
              onChange={(e) => setVehicle(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Host to meet *</Label>
            <Select value={hostStaffId} onValueChange={setHostStaffId}>
              <SelectTrigger>
                <SelectValue placeholder="Select host">
                  {hostName || undefined}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {staff?.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {departments.map((d) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          ID verification is a front-desk step; document scanning/storage is not
          part of this frontend build.
        </p>
        {error && (
          <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button onClick={submit} disabled={busy}>
            Generate badge & check in <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
