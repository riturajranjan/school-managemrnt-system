import { DOC_BRANDING } from "@/lib/data/seed/documents";
import {
  documentTypeLabels,
  type DocumentKind,
  type DocumentType,
  type PaperSize,
} from "@/lib/types/documents";
import { PaperFrame } from "./paper-frame";
import { QrToken } from "./qr-token";

export type DocumentSheetData = {
  type: DocumentType;
  kind: DocumentKind;
  paperSize: PaperSize;
  number?: string;
  accent: string;
  recipientName: string;
  recipientSubtitle?: string;
  fields: Record<string, string>;
  signatoryName?: string;
  issuedDate?: string;
  token?: string;
  showSeal?: boolean;
};

function Letterhead({ accent }: { accent: string }) {
  return (
    <div
      className="flex items-center gap-3 border-b pb-2"
      style={{ borderColor: accent }}>
      <span
        className="flex size-10 items-center justify-center rounded-md text-sm font-bold text-white"
        style={{ background: accent }}>
        N
      </span>
      <div className="min-w-0">
        <p className="text-base font-bold leading-tight text-neutral-900">
          {DOC_BRANDING.name}
        </p>
        <p className="text-[10px] text-neutral-500">{DOC_BRANDING.address}</p>
        <p className="text-[10px] text-neutral-500">{DOC_BRANDING.contact}</p>
      </div>
    </div>
  );
}

function SignatureBlock({
  name,
  showSeal,
  accent,
}: {
  name?: string;
  showSeal?: boolean;
  accent: string;
}) {
  return (
    <div className="flex items-end justify-between">
      {showSeal ? (
        <div
          className="flex size-16 items-center justify-center rounded-full border-2 text-[9px] font-bold uppercase"
          style={{ borderColor: accent, color: accent }}>
          Seal
        </div>
      ) : (
        <span />
      )}
      <div className="text-right">
        <div className="mb-1 h-8 w-32" />
        <div className="w-40 border-t border-neutral-400" />
        <p className="text-sm font-semibold text-neutral-800">
          {name ?? "Authorised Signatory"}
        </p>
      </div>
    </div>
  );
}

function certificateBody(data: DocumentSheetData): {
  title: string;
  body: string;
} {
  const f = data.fields;
  const name = data.recipientName;
  switch (data.type) {
    case "bonafide-certificate":
      return {
        title: "Bonafide Certificate",
        body: `This is to certify that ${name} is a bonafide student of ${f.class ?? data.recipientSubtitle ?? ""} at ${DOC_BRANDING.name} for the academic session ${f.session ?? DOC_BRANDING.session}. This certificate is issued for the purpose of ${f.purpose ?? "official use"}.`,
      };
    case "character-certificate":
    case "conduct-certificate":
      return {
        title: "Character Certificate",
        body: `This is to certify that ${name} of ${f.class ?? data.recipientSubtitle ?? ""} bore a ${f.conduct ?? "good"} moral character during their time at ${DOC_BRANDING.name} for the session ${f.session ?? DOC_BRANDING.session}. We wish them success in all future endeavours.`,
      };
    case "study-certificate":
      return {
        title: "Study Certificate",
        body: `This is to certify that ${name} studied in ${f.class ?? data.recipientSubtitle ?? ""} at ${DOC_BRANDING.name} during the academic session ${f.session ?? DOC_BRANDING.session}.`,
      };
    case "attendance-certificate":
      return {
        title: "Attendance Certificate",
        body: `This is to certify that ${name} of ${f.class ?? data.recipientSubtitle ?? ""} maintained an attendance of ${f.attendance ?? "—"} during the academic session ${f.session ?? DOC_BRANDING.session}.`,
      };
    case "transfer-certificate":
    case "school-leaving-certificate":
      return {
        title: "Transfer Certificate",
        body: `This is to certify that ${name} (Admission No. ${f.admissionNumber ?? data.fields.admissionNumber ?? "—"}), ${f.fatherName ? `son/daughter of ${f.fatherName}, ` : ""}was a student of ${f.class ?? data.recipientSubtitle ?? ""} at ${DOC_BRANDING.name}. Conduct: ${f.conduct ?? "Good"}. Reason for leaving: ${f.reason ?? "—"}.`,
      };
    case "participation-certificate":
      return {
        title: "Certificate of Participation",
        body: `This certificate is proudly presented to ${name} for participation in ${f.eventName ?? f.purpose ?? "the school activity"} held at ${DOC_BRANDING.name}.`,
      };
    case "sports-certificate":
    case "achievement-certificate":
      return {
        title: "Certificate of Achievement",
        body: `Awarded to ${name} in recognition of ${f.position ?? "outstanding performance"} in ${f.eventName ?? "the event"} at ${DOC_BRANDING.name}.`,
      };
    default:
      return {
        title: documentTypeLabels[data.type],
        body: f.custom_text ?? `Issued to ${name} by ${DOC_BRANDING.name}.`,
      };
  }
}

/** Renders a certificate / letter / admit-card / receipt as a print-styled
 * white sheet at the exact paper aspect ratio. Never inverted in dark mode. */
export function DocumentSheet({ data }: { data: DocumentSheetData }) {
  const accent = data.accent;
  const dateStr = data.issuedDate ?? new Date().toISOString().slice(0, 10);

  if (data.kind === "receipt") {
    return (
      <PaperFrame size="thermal" maxWidth={280}>
        <div className="flex h-full flex-col p-3 font-mono text-[10px] text-neutral-900">
          <p className="text-center text-xs font-bold">{DOC_BRANDING.name}</p>
          <p className="text-center text-[9px] text-neutral-500">
            {documentTypeLabels[data.type]}
          </p>
          <div className="my-1 border-t border-dashed border-neutral-400" />
          <div className="flex justify-between">
            <span>No.</span>
            <span>{data.number ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Name</span>
            <span>{data.recipientName}</span>
          </div>
          <div className="flex justify-between">
            <span>Class</span>
            <span>{data.recipientSubtitle ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{dateStr}</span>
          </div>
          <div className="my-1 border-t border-dashed border-neutral-400" />
          <div className="flex justify-between">
            <span>Amount</span>
            <span>{data.fields.amount ?? "₹0.00"}</span>
          </div>
          <div className="mt-auto pt-2 text-center text-[8px] text-neutral-400">
            This is a computer-generated receipt (mock preview).
          </div>
        </div>
      </PaperFrame>
    );
  }

  if (data.kind === "admit-card") {
    return (
      <PaperFrame size={data.paperSize} maxWidth={420}>
        <div className="flex h-full flex-col p-4 text-neutral-900">
          <Letterhead accent={accent} />
          <p
            className="mt-2 text-center text-sm font-bold uppercase tracking-wide"
            style={{ color: accent }}>
            Exam Admit Card
          </p>
          <div className="mt-2 flex gap-3">
            <div className="flex-1 space-y-1 text-[11px]">
              <Row label="Name" value={data.recipientName} />
              <Row
                label="Class"
                value={data.recipientSubtitle ?? data.fields.class ?? "—"}
              />
              <Row label="Roll No." value={data.fields.rollNumber ?? "—"} />
              <Row
                label="Exam"
                value={
                  data.fields.eventName ??
                  data.fields.examName ??
                  "Term Examination"
                }
              />
              <Row
                label="Centre"
                value={data.fields.centre ?? DOC_BRANDING.name}
              />
            </div>
            <div className="flex size-20 shrink-0 items-center justify-center rounded border border-neutral-300 bg-neutral-50 text-[9px] text-neutral-400">
              Photo
            </div>
          </div>
          <div className="mt-2 rounded border border-neutral-200 bg-neutral-50 p-2 text-[9px] text-neutral-600">
            <p className="font-semibold text-neutral-700">Instructions</p>
            <p>
              Carry this admit card and school ID. Reach the centre 30 minutes
              early. Electronic devices are not permitted.
            </p>
          </div>
          <div className="mt-auto flex items-end justify-between pt-2">
            {data.token && (
              <QrToken token={data.token} size={56} label="Admit card QR" />
            )}
            <SignatureBlock name={data.signatoryName} accent={accent} />
          </div>
        </div>
      </PaperFrame>
    );
  }

  if (data.kind === "letter" || data.kind === "staff-certificate") {
    return (
      <PaperFrame size={data.paperSize} maxWidth={520}>
        <div className="flex h-full flex-col p-6 text-neutral-900">
          <Letterhead accent={accent} />
          <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-500">
            <span>Ref: {data.number ?? "—"}</span>
            <span>Date: {dateStr}</span>
          </div>
          <p className="mt-3 text-sm font-semibold">
            To,
            <br />
            {data.recipientName}
            <br />
            <span className="font-normal text-neutral-600">
              {data.recipientSubtitle}
            </span>
          </p>
          <p className="mt-3 text-sm font-semibold underline">
            Subject: {documentTypeLabels[data.type]}
          </p>
          <p className="mt-2 text-sm leading-relaxed text-neutral-700">
            This is to certify that {data.recipientName}{" "}
            {data.fields.employeeId
              ? `(Employee ID ${data.fields.employeeId})`
              : ""}{" "}
            has been associated with {DOC_BRANDING.name} as{" "}
            {data.fields.designation ?? "a member of staff"}
            {data.fields.joiningDate ? ` since ${data.fields.joiningDate}` : ""}
            . This letter is issued on request for official purposes.
          </p>
          <div className="mt-auto flex items-end justify-between pt-4">
            {data.token && (
              <QrToken token={data.token} size={56} label="Letter QR" />
            )}
            <SignatureBlock
              name={data.signatoryName}
              showSeal
              accent={accent}
            />
          </div>
        </div>
      </PaperFrame>
    );
  }

  // Certificates (student / activity)
  const { title, body } = certificateBody(data);
  return (
    <PaperFrame
      size={data.paperSize}
      maxWidth={data.paperSize === "cert-landscape" ? 560 : 460}>
      <div
        className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center"
        style={{
          boxShadow: `inset 0 0 0 6px ${accent}22, inset 0 0 0 8px ${accent}`,
        }}>
        <p
          className="text-[10px] font-semibold uppercase tracking-[0.3em]"
          style={{ color: accent }}>
          {DOC_BRANDING.name}
        </p>
        {data.number && (
          <p className="absolute right-4 top-4 text-[9px] text-neutral-400">
            No. {data.number}
          </p>
        )}
        <p className="text-xl font-bold text-neutral-900">{title}</p>
        <div className="h-px w-20" style={{ background: accent }} />
        <p className=" text-sm leading-relaxed text-neutral-700">{body}</p>
        <div className="mt-3 flex w-full items-end justify-between px-4">
          <div className="text-left text-[10px] text-neutral-500">
            <div className="mb-0.5 w-24 border-t border-neutral-400" />
            <span>{dateStr}</span>
            <br />
            <span className="text-neutral-400">Date</span>
          </div>
          {data.token && (
            <QrToken token={data.token} size={52} label="Certificate QR" />
          )}
          <div className="text-right text-[10px] text-neutral-500">
            <div className="mb-0.5 ml-auto w-28 border-t border-neutral-400" />
            <span className="font-semibold text-neutral-700">
              {data.signatoryName ?? "Principal"}
            </span>
          </div>
        </div>
      </div>
    </PaperFrame>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2">
      <span className="w-16 shrink-0 text-neutral-400">{label}</span>
      <span className="font-medium text-neutral-800">{value}</span>
    </div>
  );
}
