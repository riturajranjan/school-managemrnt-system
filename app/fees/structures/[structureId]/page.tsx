"use client";

import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";
import { Archive, ArchiveRestore, Copy, History, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useManagedClasses } from "@/lib/hooks/use-academics";
import { useDiscounts, useFeeStructure, useFeeStructures, useScholarships } from "@/lib/hooks/use-finance";
import { useSisStore } from "@/lib/hooks/use-store";
import { formatMoney, sumMoney } from "@/lib/finance/money";
import { archiveFeeStructure, duplicateFeeStructure, structureTotal, unarchiveFeeStructure } from "@/lib/services/fee-structure-service";
import { admissionTypeFilterLabels, feeComponentTypeLabels, prorationRuleLabels } from "@/lib/types/fees";
import { formatDate } from "@/lib/utils";

const ACTOR = { name: "Finance Administrator", role: "Finance Administrator" };

export default function FeeStructureWorkspacePage({ params }: { params: Promise<{ structureId: string }> }) {
  const { structureId } = use(params);
  const router = useRouter();
  const structure = useFeeStructure(structureId);
  const allStructures = useFeeStructures();
  const classes = useManagedClasses();
  const db = useSisStore();
  const discounts = useDiscounts();
  const scholarships = useScholarships();
  const { can } = usePermissions();
  const canManage = can("fees.manageStructures");

  if (!structure) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Fee structure not found</p>
        <Button asChild variant="outline">
          <Link href="/fees/structures">Back to structures</Link>
        </Button>
      </div>
    );
  }

  const className = structure.applicableClassIds.length === 0 ? "All classes" : structure.applicableClassIds.map((id) => classes.find((c) => c.id === id)?.name ?? id).join(", ");
  const items = db.studentFeeItems.filter((i) => i.structureId === structure.id);
  const assignments = db.studentFeeAssignments.filter((a) => a.structureId === structure.id);
  const billed = sumMoney(items.map((i) => i.billedAmount), structure.currency);
  const collected = sumMoney(items.map((i) => i.paidAmount), structure.currency);
  const percent = billed.minorUnits === 0 ? 0 : Math.round((collected.minorUnits / billed.minorUnits) * 100);

  const structureDiscounts = discounts.filter((d) => d.applicableComponentIds.some((id) => structure.components.some((c) => c.id === id)));
  const structureScholarships = scholarships.filter((s) => s.applicableComponentIds.some((id) => structure.components.some((c) => c.id === id)));
  const derivedFrom = allStructures.find((s) => s.id === structure.previousVersionId);
  const derivedInto = allStructures.filter((s) => s.previousVersionId === structure.id);

  function studentName(studentId: string) {
    const s = db.students.find((st) => st.id === studentId);
    return s ? `${s.profile.firstName} ${s.profile.lastName}` : studentId;
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between sm:p-md">
        <div>
          <div className="flex items-center gap-xs">
            <h1 className="text-base font-semibold text-foreground">{structure.name}</h1>
            <Badge tone={structure.status === "active" ? "success" : structure.status === "draft" ? "neutral" : "warning"}>{structure.status}</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            {structure.session} · {className} · v{structure.version}
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap items-center gap-xs">
            <Button size="sm" variant="outline" asChild>
              <Link href={`/fees/assignments?structureId=${structure.id}`}>
                <UserPlus className="size-3.5" />
                Assign students
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => duplicateFeeStructure(structure.id, ACTOR)}>
              <Copy className="size-3.5" />
              Duplicate
            </Button>
            {structure.status === "archived" ? (
              <Button size="sm" variant="outline" onClick={() => unarchiveFeeStructure(structure.id, ACTOR)}>
                <ArchiveRestore className="size-3.5" />
                Restore
              </Button>
            ) : (
              <Button size="sm" variant="outline" className="text-error" onClick={() => archiveFeeStructure(structure.id, ACTOR)}>
                <Archive className="size-3.5" />
                Archive
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Total per student</p>
          <p className="text-sm font-semibold text-foreground">{formatMoney(structureTotal(structure))}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Students billed</p>
          <p className="text-sm font-semibold text-foreground">{new Set(items.map((i) => i.studentId)).size}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Collected</p>
          <p className="text-sm font-semibold text-success">{formatMoney(collected, { compact: true })}</p>
        </div>
        <div className="rounded-lg border border-border bg-surface p-sm">
          <p className="text-xs text-muted-foreground">Collection rate</p>
          <p className="text-sm font-semibold text-foreground">{percent}%</p>
        </div>
      </div>

      <Tabs defaultValue="components">
        <TabsList>
          <TabsTrigger value="components">Components</TabsTrigger>
          <TabsTrigger value="installments">Installments</TabsTrigger>
          <TabsTrigger value="students">Applicable students</TabsTrigger>
          <TabsTrigger value="discounts">Discounts &amp; scholarships</TabsTrigger>
          <TabsTrigger value="rules">Rules</TabsTrigger>
          <TabsTrigger value="history">Version history</TabsTrigger>
        </TabsList>

        <TabsContent value="components" className="mt-md">
          <div className="flex flex-col gap-sm">
            {structure.components.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-lg border border-border p-sm">
                <div>
                  <p className="text-sm font-medium text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {feeComponentTypeLabels[c.type]}
                    {c.optional && " · Optional"}
                    {c.refundable && " · Refundable"}
                    {c.taxable && ` · ${c.taxPercent ?? 0}% tax`}
                  </p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatMoney(c.amount)}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="installments" className="mt-md">
          <div className="flex flex-col gap-sm">
            {structure.installments.map((i, index) => (
              <div key={i.id} className="flex items-center justify-between rounded-lg border border-border p-sm">
                <div>
                  <p className="text-sm font-medium text-foreground">{i.label || `Installment ${index + 1}`}</p>
                  <p className="text-xs text-muted-foreground">Due {formatDate(i.dueDate)}</p>
                </div>
                <span className="text-sm font-semibold text-foreground">{formatMoney(i.amount)}</span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="students" className="mt-md">
          {assignments.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-md text-center text-sm text-muted-foreground">No students assigned to this structure yet.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {assignments.map((a) => {
                const studentItems = items.filter((i) => i.assignmentId === a.id);
                const studentPaid = sumMoney(studentItems.map((i) => i.paidAmount), structure.currency);
                const studentBilled = sumMoney(studentItems.map((i) => i.billedAmount), structure.currency);
                return (
                  <Link
                    key={a.id}
                    href={`/students/${a.studentId}/fees`}
                    className="flex items-center justify-between rounded-md border border-border px-sm py-2 text-sm outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <span className="text-foreground">{studentName(a.studentId)}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatMoney(studentPaid, { compact: true })} / {formatMoney(studentBilled, { compact: true })}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="discounts" className="mt-md">
          <div className="flex flex-col gap-md">
            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Discounts</h3>
              {structureDiscounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">No discounts applied against this structure&apos;s components.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {structureDiscounts.map((d) => (
                    <div key={d.id} className="flex items-center justify-between rounded-md border border-border px-sm py-2 text-sm">
                      <span className="text-foreground">
                        {studentName(d.studentId)} — {d.name}
                      </span>
                      <Badge tone="info">{d.percent ? `${d.percent}%` : formatMoney(d.amount!)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div>
              <h3 className="mb-xs text-sm font-semibold text-foreground">Scholarships</h3>
              {structureScholarships.length === 0 ? (
                <p className="text-sm text-muted-foreground">No scholarships applied against this structure&apos;s components.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {structureScholarships.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border px-sm py-2 text-sm">
                      <span className="text-foreground">
                        {studentName(s.studentId)} — {s.name}
                      </span>
                      <Badge tone="info">{s.percent ? `${s.percent}%` : formatMoney(s.amount!)}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="rules" className="mt-md">
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div className="rounded-lg border border-border p-sm">
              <p className="text-xs text-muted-foreground">Admission type</p>
              <p className="text-sm text-foreground">{admissionTypeFilterLabels[structure.admissionType]}</p>
            </div>
            <div className="rounded-lg border border-border p-sm">
              <p className="text-xs text-muted-foreground">Grace period</p>
              <p className="text-sm text-foreground">{structure.gracePeriodDays} days</p>
            </div>
            <div className="rounded-lg border border-border p-sm">
              <p className="text-xs text-muted-foreground">Proration rule</p>
              <p className="text-sm text-foreground">{prorationRuleLabels[structure.prorationRule]}</p>
            </div>
            <div className="rounded-lg border border-border p-sm">
              <p className="text-xs text-muted-foreground">Discount compatible</p>
              <p className="text-sm text-foreground">{structure.discountCompatible ? "Yes" : "No"}</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="history" className="mt-md">
          <div className="flex flex-col gap-sm">
            <div className="flex items-center gap-sm rounded-lg border border-border p-sm text-sm">
              <History className="size-4 text-muted-foreground" />
              <span className="text-foreground">
                Version {structure.version} · Created {formatDate(structure.createdAt)} · Last updated {formatDate(structure.updatedAt)}
              </span>
            </div>
            {derivedFrom && (
              <Link href={`/fees/structures/${derivedFrom.id}`} className="rounded-lg border border-border p-sm text-sm text-foreground outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                Copied from <span className="font-medium">{derivedFrom.name}</span> ({derivedFrom.session})
              </Link>
            )}
            {derivedInto.map((d) => (
              <Link key={d.id} href={`/fees/structures/${d.id}`} className="rounded-lg border border-border p-sm text-sm text-foreground outline-none hover:bg-surface-secondary/60 focus-visible:ring-2 focus-visible:ring-ring">
                Copied into <span className="font-medium">{d.name}</span> ({d.session})
              </Link>
            ))}
            {!derivedFrom && derivedInto.length === 0 && <p className="text-sm text-muted-foreground">No other versions linked to this structure.</p>}
          </div>
        </TabsContent>
      </Tabs>

      <div className="flex justify-start">
        <Button variant="ghost" size="sm" onClick={() => router.push("/fees/structures")}>
          Back to structures
        </Button>
      </div>
    </div>
  );
}
