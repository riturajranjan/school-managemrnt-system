import type {
  CertificateTemplate,
  ResultPosition,
} from "@/lib/types/activities";
import { resultPositionLabels } from "@/lib/types/activities";

export type CertificatePreviewData = {
  template: CertificateTemplate;
  recipientName: string;
  eventTitle: string;
  position?: ResultPosition;
  issuedDate: string;
  serial?: string;
};

const borderStyles: Record<CertificateTemplate["borderStyle"], string> = {
  classic: "border-[6px] border-double",
  modern: "border-2",
  minimal: "border",
  ornate: "border-[8px] border-double",
};

function fillTokens(text: string, d: CertificatePreviewData): string {
  return text
    .replaceAll("{name}", d.recipientName || "________")
    .replaceAll("{event}", d.eventTitle || "________")
    .replaceAll("{date}", d.issuedDate)
    .replaceAll(
      "{position}",
      d.position ? resultPositionLabels[d.position] : "participation",
    );
}

/** A print-styled certificate. Deliberately committed to a light "paper" look
 * regardless of the app theme — a certificate should look the same printed or
 * on a dark screen. Colours are hard-coded (not theme tokens) on purpose. */
export function CertificatePreview({ data }: { data: CertificatePreviewData }) {
  const { template: t } = data;
  const accent = t.accentColor;
  return (
    <div
      className={`relative mx-auto w-full  overflow-hidden rounded-md bg-white p-8 text-center shadow-lg ${borderStyles[t.borderStyle]} ${t.orientation === "portrait" ? "aspect-[3/4]" : "aspect-[4/3]"}`}
      style={{ borderColor: accent, color: "#1a1a1a" }}>
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p
          className="text-xs font-semibold uppercase tracking-[0.3em]"
          style={{ color: accent }}>
          Novyra Campus
        </p>
        <p className="text-[11px] uppercase tracking-widest text-neutral-500">
          Certificate of {t.purpose}
        </p>
        <div className="my-1 h-px w-24" style={{ backgroundColor: accent }} />
        <p className="text-sm text-neutral-600">This is proudly presented to</p>
        <p className="font-serif text-2xl font-bold" style={{ color: "#111" }}>
          {data.recipientName || "Recipient Name"}
        </p>
        <p className=" text-sm leading-relaxed text-neutral-700">
          {fillTokens(t.bodyText, data)}
        </p>
        {t.showSeal && (
          <div
            className="mt-2 flex size-14 items-center justify-center rounded-full border-2 text-[9px] font-bold uppercase"
            style={{ borderColor: accent, color: accent }}>
            Seal
          </div>
        )}
        <div className="mt-3 flex w-full items-end justify-between px-6 text-xs text-neutral-600">
          <div className="text-left">
            <div className="mb-0.5 w-24 border-t border-neutral-400" />
            <span>{data.issuedDate}</span>
            <br />
            <span className="text-[10px] text-neutral-400">Date</span>
          </div>
          <div className="text-right">
            <div className="mb-0.5 ml-auto w-28 border-t border-neutral-400" />
            <span>{t.signatoryTitle}</span>
          </div>
        </div>
        {data.serial && (
          <p className="absolute bottom-2 left-3 text-[9px] text-neutral-400">
            Ref: {data.serial}
          </p>
        )}
      </div>
    </div>
  );
}
