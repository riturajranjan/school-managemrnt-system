"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function NewPlanPage() {
  const [name, setName] = useState("");
  const [monthly, setMonthly] = useState(9999);
  const [students, setStudents] = useState(500);
  const [saved, setSaved] = useState(false);

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2"><Button asChild size="sm" variant="ghost"><Link href="/super-admin/plans"><ArrowLeft className="size-4" /></Link></Button><div><h1 className="text-lg font-semibold text-foreground">New plan</h1><p className="text-xs text-muted-foreground">Draft a subscription plan (frontend only)</p></div></div>
      <div className="surface-3d flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <div><Label htmlFor="p-name">Plan name</Label><Input id="p-name" value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} placeholder="e.g. Growth+" /></div>
        <div className="grid grid-cols-2 gap-sm"><div><Label htmlFor="p-monthly">Monthly price (₹)</Label><Input id="p-monthly" type="number" value={monthly} onChange={(e) => setMonthly(Number(e.target.value))} /></div><div><Label htmlFor="p-students">Student limit</Label><Input id="p-students" type="number" value={students} onChange={(e) => setStudents(Number(e.target.value))} /></div></div>
        <div><Label htmlFor="p-desc">Description</Label><Textarea id="p-desc" rows={2} placeholder="Short description" /></div>
        {saved && <p className="rounded-md border border-success/30 bg-success/8 p-sm text-xs text-success">Plan drafted (simulation — not persisted).</p>}
        <div className="flex justify-end gap-xs"><Button asChild size="sm" variant="ghost"><Link href="/super-admin/plans">Cancel</Link></Button><Button size="sm" onClick={() => setSaved(true)} disabled={!name.trim()}>Create plan (simulation)</Button></div>
      </div>
    </div>
  );
}
