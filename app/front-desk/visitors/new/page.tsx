"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, BadgeCheck, Check, ChevronRight, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QrGlyph } from "@/components/library/code-label";
import { CampusMap } from "@/components/communication/campus-map";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useSisStore } from "@/lib/hooks/use-store";
import { checkInVisitor } from "@/lib/services/communication-service";
import { roleLabels } from "@/lib/permissions/roles";
import { visitorTypeLabels, type VisitorType } from "@/lib/types/communication";
import { formatDate } from "@/lib/utils";

const departments = ["Academics", "Administration", "Accounts", "HR", "Principal Office", "Library"];

export default function VisitorCheckInPage() {
  const db = useSisStore();
  const router = useRouter();
  const { can, role } = usePermissions();
  const hosts = db.employees.slice(0, 40).map((e) => `${e.firstName} ${e.lastName}`);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [org, setOrg] = useState("");
  const [type, setType] = useState<VisitorType>("parent");
  const [purpose, setPurpose] = useState("");
  const [host, setHost] = useState(hosts[0] ?? "");
  const [department, setDepartment] = useState(departments[0]);
  const [vehicle, setVehicle] = useState("");
  const [badge, setBadge] = useState<{ number: string; token: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!can("frontdesk.manage")) return <PermissionDenied action="check in visitors" role={roleLabels[role]} backHref="/front-desk/visitors" />;

  function submit() {
    setError(null);
    if (!name.trim()) return setError("Visitor name is required.");
    if (!host) return setError("Select a host to meet.");
    const result = checkInVisitor({ name, phone, organization: org || undefined, purpose: purpose || "Visit", hostName: host, department, type, vehicleNumber: vehicle || undefined });
    if (!result.ok) return setError(result.error);
    const v = db.visitors.find((x) => x.id === result.visitorId);
    setBadge({ number: v?.visitorNumber ?? "V-000", token: v?.badgeCode ?? "BADGE" });
  }

  if (badge) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-md pb-20 sm:pb-0">
        <div className="flex items-center gap-2 rounded-md border border-success/30 bg-success/8 p-sm text-sm text-success">
          <Check className="size-4" /> {name} checked in. Host <span className="font-medium">{host}</span> notified (in-app).
        </div>
        <div className="mx-auto w-full max-w-xs rounded-xl border border-border bg-surface p-md shadow-floating">
          <div className="mb-2 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-primary">VISITOR</p>
              <p className="text-sm font-bold text-foreground">{name}</p>
            </div>
            <BadgeCheck className="size-6 text-primary" />
          </div>
          <div className="flex items-center gap-3">
            <QrGlyph value={badge.token} size={72} />
            <div className="text-xs text-muted-foreground">
              <p><span className="text-foreground">Host:</span> {host}</p>
              <p><span className="text-foreground">Dept:</span> {department}</p>
              <p><span className="text-foreground">Date:</span> {formatDate(new Date().toISOString())}</p>
              <p className="mt-1 font-mono text-[11px]">{badge.number}</p>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-muted-foreground">QR encodes an opaque badge token only — no personal data.</p>
        </div>
        <div className="flex justify-center gap-xs">
          <Button variant="outline" onClick={() => window.print()}>Print badge</Button>
          <Button onClick={() => router.push("/front-desk/visitors")}>Done</Button>
        </div>
        <div className="rounded-lg border border-border bg-surface p-md">
          <h2 className="mb-sm flex items-center gap-1 text-sm font-semibold text-foreground"><MapPin className="size-4" /> Directions to {department}</h2>
          <CampusMap highlight={department} />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-sm">
        <Button asChild size="icon" variant="ghost" aria-label="Back"><Link href="/front-desk/visitors"><ArrowLeft className="size-4" /></Link></Button>
        <div>
          <h1 className="text-lg font-semibold text-foreground">Visitor check-in</h1>
          <p className="text-xs text-muted-foreground">Register the visitor and generate a badge</p>
        </div>
      </div>

      <div className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
          <div className="flex flex-col gap-1.5"><Label htmlFor="vname">Full name *</Label><Input id="vname" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="vphone">Phone</Label><Input id="vphone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 …" /></div>
          <div className="flex flex-col gap-1.5"><Label>Visitor type</Label>
            <Select value={type} onValueChange={(v) => setType(v as VisitorType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{(Object.keys(visitorTypeLabels) as VisitorType[]).map((t) => <SelectItem key={t} value={t}>{visitorTypeLabels[t]}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="vorg">Organization</Label><Input id="vorg" value={org} onChange={(e) => setOrg(e.target.value)} placeholder="Optional" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="vpurp">Purpose</Label><Input id="vpurp" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Meet class teacher" /></div>
          <div className="flex flex-col gap-1.5"><Label htmlFor="vveh">Vehicle number</Label><Input id="vveh" value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Optional" /></div>
          <div className="flex flex-col gap-1.5"><Label>Host to meet *</Label>
            <Select value={host} onValueChange={setHost}><SelectTrigger><SelectValue placeholder="Select host" /></SelectTrigger><SelectContent>{hosts.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="flex flex-col gap-1.5"><Label>Department</Label>
            <Select value={department} onValueChange={setDepartment}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{departments.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent></Select>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">ID verification is a front-desk step; document scanning/storage is not part of this frontend build.</p>
        {error && <p className="rounded-md border border-error/30 bg-error/8 p-sm text-sm text-error">{error}</p>}
        <div className="flex justify-end">
          <Button onClick={submit}>Generate badge & check in <ChevronRight className="size-4" /></Button>
        </div>
      </div>
    </div>
  );
}
