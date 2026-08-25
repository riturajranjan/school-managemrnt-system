"use client";

import { useState } from "react";
import { Plus, ScrollText, ShieldAlert } from "lucide-react";
import { DataTable } from "@/components/data-table/data-table";
import type { ColumnDef } from "@/components/data-table/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { StatTile } from "@/components/ui/stat-tile";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionDenied } from "@/components/library/permission-denied";
import { usePermissions } from "@/components/providers/permissions-provider";
import { useTransportDocuments, useTransportVehicles, useCurrentTransportStaff, addTransportDocumentRequest } from "@/lib/hooks/api/use-transport-api";
import { roleLabels } from "@/lib/permissions/roles";
import type { TransportDocumentDto, TransportDocumentEffectiveStatusDto, TransportDocumentSubjectTypeDto, TransportDocumentTypeDto } from "@/lib/api/contracts";
import { formatDate } from "@/lib/utils";

const vehicleTypeLabels: Record<string, string> = { insurance: "Insurance", registration: "Registration", "fitness-certificate": "Fitness certificate", permit: "Permit", "pollution-certificate": "Pollution certificate" };
const staffTypeLabels: Record<string, string> = { "driving-license": "Driving license", "police-verification": "Police verification", "medical-certificate": "Medical certificate" };
const allTypeLabels: Record<TransportDocumentTypeDto, string> = { ...vehicleTypeLabels, ...staffTypeLabels } as Record<TransportDocumentTypeDto, string>;
const vehicleDocTypes = Object.keys(vehicleTypeLabels) as TransportDocumentTypeDto[];
const staffDocTypes = Object.keys(staffTypeLabels) as TransportDocumentTypeDto[];

const statusTone: Record<TransportDocumentEffectiveStatusDto, "success" | "warning" | "error" | "neutral"> = { valid: "success", "expiring-soon": "warning", expired: "error", "no-expiry": "neutral" };
const statusLabel: Record<TransportDocumentEffectiveStatusDto, string> = { valid: "Valid", "expiring-soon": "Expiring soon", expired: "Expired", "no-expiry": "No expiry set" };

export default function TransportDocumentsPage() {
  const { data, loading, error, reload } = useTransportDocuments();
  const { data: vehicles } = useTransportVehicles();
  const { data: drivers } = useCurrentTransportStaff("driver");
  const { data: attendants } = useCurrentTransportStaff("attendant");
  const { hasServerPermission, capabilitiesLoading, role } = usePermissions();
  const documents = data?.documents ?? [];
  const vehicleDocs = documents.filter((d) => d.subjectType === "vehicle");
  const staffDocs = documents.filter((d) => d.subjectType === "staff");
  const staffOptions = [...new Map([...(drivers ?? []), ...(attendants ?? [])].map((a) => [a.staffId, a.staffName])).entries()];

  const [addOpen, setAddOpen] = useState(false);
  const [subject, setSubject] = useState<TransportDocumentSubjectTypeDto>("vehicle");
  const [entityId, setEntityId] = useState("");
  const [docType, setDocType] = useState<TransportDocumentTypeDto>("insurance");
  const [documentNumber, setDocumentNumber] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [busy, setBusy] = useState(false);

  if (!capabilitiesLoading && !hasServerPermission("transport.view")) {
    return <PermissionDenied action="view transport documents" role={roleLabels[role]} backHref="/transport" />;
  }
  const canManage = hasServerPermission("transport.manage");

  async function submit() {
    if (!entityId) return;
    setBusy(true);
    const result = await addTransportDocumentRequest({
      subjectType: subject, vehicleId: subject === "vehicle" ? entityId : undefined, staffId: subject === "staff" ? entityId : undefined,
      type: docType, documentNumber: documentNumber.trim() || undefined, expiryDate: expiryDate || undefined,
    });
    setBusy(false);
    if (result.success) {
      setAddOpen(false);
      setEntityId("");
      setDocumentNumber("");
      setExpiryDate("");
      reload();
    }
  }

  function renderDocMobileCard(d: TransportDocumentDto) {
    return (
      <div className="surface-3d flex flex-col gap-1 rounded-lg border border-border bg-surface p-sm">
        <div className="flex items-center justify-between gap-xs">
          <p className="truncate text-sm font-semibold text-foreground">{d.vehicleRegistration ?? d.staffName ?? "—"}</p>
          <Badge tone={statusTone[d.effectiveStatus]}>{statusLabel[d.effectiveStatus]}</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          {allTypeLabels[d.type]} {d.expiryDate ? `· ${formatDate(d.expiryDate)}` : ""}
        </p>
      </div>
    );
  }

  function columnsFor(): ColumnDef<TransportDocumentDto>[] {
    return [
      {
        id: "subject",
        header: "Subject",
        alwaysVisible: true,
        sortValue: (d) => d.vehicleRegistration ?? d.staffName ?? "",
        cell: (d) => <p className="text-sm font-medium text-foreground">{d.vehicleRegistration ?? d.staffName ?? "—"}</p>,
      },
      { id: "type", header: "Document", cell: (d) => <span className="text-sm text-muted-foreground">{allTypeLabels[d.type]}</span> },
      { id: "expiry", header: "Expiry", cell: (d) => <span className="text-sm text-muted-foreground">{d.expiryDate ? formatDate(d.expiryDate) : "—"}</span> },
      { id: "status", header: "Status", align: "right", cell: (d) => <Badge tone={statusTone[d.effectiveStatus]}>{statusLabel[d.effectiveStatus]}</Badge> },
    ];
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Documents &amp; compliance</h1>
          <p className="text-xs text-muted-foreground">Vehicle and driver document expiry tracking — metadata only, no file upload</p>
        </div>
        {canManage && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add document
          </Button>
        )}
      </div>

      {error ? (
        <div className="rounded-lg border border-error/30 bg-error/5 p-md text-sm text-error" role="alert">
          Could not load documents: {error}
          <Button variant="outline" size="sm" className="ml-sm" onClick={reload}>
            Retry
          </Button>
        </div>
      ) : loading && !data ? (
        <div className="rounded-lg border border-border bg-surface p-2xl text-center text-sm text-muted-foreground">Loading documents…</div>
      ) : data ? (
        <>
          <div className="grid grid-cols-2 gap-sm sm:grid-cols-4">
            <StatTile label="Expired documents" value={String(data.compliance.expiredCount)} tone={data.compliance.expiredCount > 0 ? "error" : "success"} />
            <StatTile label="Expiring soon" value={String(data.compliance.expiringSoonCount)} tone={data.compliance.expiringSoonCount > 0 ? "warning" : "success"} />
            <StatTile label="Vehicles blocked" value={String(data.compliance.blockedVehicleCount)} tone={data.compliance.blockedVehicleCount > 0 ? "error" : "success"} />
            <StatTile label="Drivers blocked" value={String(data.compliance.blockedDriverCount)} tone={data.compliance.blockedDriverCount > 0 ? "error" : "success"} />
          </div>

          {(data.compliance.blockedVehicleCount > 0 || data.compliance.blockedDriverCount > 0) && (
            <div className="flex items-start gap-xs rounded-lg border border-error/30 bg-error/8 p-sm text-sm text-error">
              <ShieldAlert className="mt-0.5 size-4 shrink-0" />
              <span>Vehicles/drivers with an expired document should not be assigned to a live route until resolved.</span>
            </div>
          )}

          <Tabs defaultValue="vehicles">
            <TabsList>
              <TabsTrigger value="vehicles">Vehicles</TabsTrigger>
              <TabsTrigger value="drivers">Drivers</TabsTrigger>
            </TabsList>
            <TabsContent value="vehicles" className="mt-sm">
              <DataTable columns={columnsFor()} rows={vehicleDocs} getRowId={(d) => d.id} caption="Vehicle document compliance" renderMobileCard={renderDocMobileCard} emptyIcon={ScrollText} emptyTitle="No vehicle documents recorded" />
            </TabsContent>
            <TabsContent value="drivers" className="mt-sm">
              <DataTable columns={columnsFor()} rows={staffDocs} getRowId={(d) => d.id} caption="Driver document compliance" renderMobileCard={renderDocMobileCard} emptyIcon={ScrollText} emptyTitle="No driver documents recorded" />
            </TabsContent>
          </Tabs>
        </>
      ) : null}

      <DetailDrawer open={addOpen} onOpenChange={setAddOpen} title="Add document" description="Attach a compliance document to a vehicle or driver">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Subject</Label>
            <Select
              value={subject}
              onValueChange={(v) => {
                setSubject(v as TransportDocumentSubjectTypeDto);
                setEntityId("");
                setDocType(v === "vehicle" ? "insurance" : "driving-license");
              }}
            >
              <SelectTrigger aria-label="Subject">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vehicle">Vehicle</SelectItem>
                <SelectItem value="staff">Driver</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{subject === "vehicle" ? "Vehicle" : "Driver"}</Label>
            <Select value={entityId} onValueChange={setEntityId}>
              <SelectTrigger aria-label={subject === "vehicle" ? "Vehicle" : "Driver"}>
                <SelectValue placeholder={`Select ${subject === "vehicle" ? "vehicle" : "driver"}`} />
              </SelectTrigger>
              <SelectContent>
                {subject === "vehicle"
                  ? (vehicles ?? []).map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.registrationNumber}
                      </SelectItem>
                    ))
                  : staffOptions.map(([id, name]) => (
                      <SelectItem key={id} value={id}>
                        {name}
                      </SelectItem>
                    ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Document type</Label>
            <Select value={docType} onValueChange={(v) => setDocType(v as TransportDocumentTypeDto)}>
              <SelectTrigger aria-label="Document type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(subject === "vehicle" ? vehicleDocTypes : staffDocTypes).map((t) => (
                  <SelectItem key={t} value={t}>
                    {allTypeLabels[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="doc-number">Document number</Label>
            <Input id="doc-number" value={documentNumber} onChange={(e) => setDocumentNumber(e.target.value)} placeholder="Optional" />
          </div>
          <div>
            <Label htmlFor="doc-expiry">Expiry date</Label>
            <Input id="doc-expiry" type="date" value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />
          </div>
          <Button disabled={!entityId || busy} onClick={submit}>
            Add document
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
