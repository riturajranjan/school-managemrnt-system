import {
  paperAspect,
  idCardStyleLabels,
  type IdCardRecord,
  type IdCardStyle,
} from "@/lib/types/documents";
import { QrToken } from "./qr-token";
import { BarcodeGlyph } from "@/components/library/code-label";
import { DOC_BRANDING } from "@/lib/data/seed/documents";
import { cn } from "@/lib/utils";

type StyleTokens = {
  header: string;
  headerText: string;
  accent: string;
  body: string;
  photoRing: string;
};

const STYLES: Record<IdCardStyle, StyleTokens> = {
  "premium-teal": {
    header: "bg-[linear-gradient(135deg,#022c43,#18b0c8)]",
    headerText: "text-white",
    accent: "#18b0c8",
    body: "bg-white text-neutral-900",
    photoRing: "ring-[#18b0c8]",
  },
  "campus-modern": {
    header: "bg-[#022c43]",
    headerText: "text-white",
    accent: "#022c43",
    body: "bg-white text-neutral-900",
    photoRing: "ring-[#022c43]",
  },
  "classic-school": {
    header: "bg-[#7c3aed]",
    headerText: "text-white",
    accent: "#7c3aed",
    body: "bg-white text-neutral-900",
    photoRing: "ring-[#7c3aed]",
  },
  "minimal-institutional": {
    header: "bg-neutral-100 border-b border-neutral-300",
    headerText: "text-neutral-800",
    accent: "#334155",
    body: "bg-white text-neutral-900",
    photoRing: "ring-neutral-300",
  },
  "junior-friendly": {
    header: "bg-[linear-gradient(135deg,#f59e0b,#f97316)]",
    headerText: "text-white",
    accent: "#f59e0b",
    body: "bg-white text-neutral-900",
    photoRing: "ring-[#f59e0b]",
  },
};

function Initials({
  name,
  color,
  ring,
}: {
  name: string;
  color: string;
  ring: string;
}) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-md text-lg font-bold text-white ring-2",
        ring,
      )}
      style={{ background: color, width: "28%", aspectRatio: "3/4" }}
      aria-hidden>
      {initials}
    </div>
  );
}

/** A CR80 ID card face. Committed to a light look (an ID card is a physical
 * artefact). `side` picks front or back. Scales to container width. */
export function IdCard({
  card,
  side = "front",
  styleOverride,
  className,
}: {
  card: IdCardRecord;
  side?: "front" | "back";
  styleOverride?: IdCardStyle;
  className?: string;
}) {
  const style = STYLES[styleOverride ?? card.style];
  const ratio = paperAspect.cr80;
  return (
    <div className={cn("mx-auto w-full ", className)}>
      <div
        className="relative w-full overflow-hidden rounded-xl shadow-lg ring-1 ring-black/10"
        style={{ aspectRatio: String(ratio) }}>
        {side === "front" ? (
          <div className={cn("flex h-full flex-col", style.body)}>
            <div
              className={cn(
                "flex items-center gap-2 px-3 py-1.5",
                style.header,
                style.headerText,
              )}>
              <span className="flex size-5 items-center justify-center rounded bg-white/20 text-[10px] font-bold">
                N
              </span>
              <div className="min-w-0">
                <p className="truncate text-[11px] font-bold leading-tight">
                  {DOC_BRANDING.name}
                </p>
                <p className="truncate text-[8px] opacity-80">
                  {idCardStyleLabels[card.style]}
                </p>
              </div>
            </div>
            <div className="flex flex-1 items-center gap-3 px-3 py-2">
              <Initials
                name={card.holderName}
                color={card.photoColor}
                ring={style.photoRing}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold leading-tight">
                  {card.holderName}
                </p>
                <p className="truncate text-[10px] text-neutral-600">
                  {card.subtitle}
                </p>
                <dl className="mt-1 space-y-0.5 text-[9px] text-neutral-700">
                  {card.extra.admissionNumber && (
                    <div className="flex gap-1">
                      <dt className="text-neutral-400">Adm</dt>
                      <dd className="font-medium">
                        {card.extra.admissionNumber}
                      </dd>
                    </div>
                  )}
                  {card.extra.employeeId && (
                    <div className="flex gap-1">
                      <dt className="text-neutral-400">ID</dt>
                      <dd className="font-medium">{card.extra.employeeId}</dd>
                    </div>
                  )}
                  {card.extra.memberId && (
                    <div className="flex gap-1">
                      <dt className="text-neutral-400">Member</dt>
                      <dd className="font-medium">{card.extra.memberId}</dd>
                    </div>
                  )}
                  {card.extra.route && (
                    <div className="flex gap-1">
                      <dt className="text-neutral-400">Route</dt>
                      <dd className="font-medium">{card.extra.route}</dd>
                    </div>
                  )}
                  {card.extra.building && (
                    <div className="flex gap-1">
                      <dt className="text-neutral-400">Block</dt>
                      <dd className="font-medium">
                        {card.extra.building} · {card.extra.room}
                      </dd>
                    </div>
                  )}
                  <div className="flex gap-1">
                    <dt className="text-neutral-400">Card</dt>
                    <dd className="font-medium">{card.cardNumber}</dd>
                  </div>
                </dl>
              </div>
            </div>
            <div
              className="flex items-center justify-between px-3 pb-1.5 text-[8px] text-neutral-500"
              style={{ borderTop: `2px solid ${style.accent}` }}>
              <span>Valid till {card.expiryDate}</span>
              <span className="font-semibold" style={{ color: style.accent }}>
                {DOC_BRANDING.website}
              </span>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "flex h-full flex-col justify-between p-3",
              style.body,
            )}>
            <div className="flex items-start justify-between gap-2">
              <div className="text-[9px] text-neutral-700">
                <p className="mb-1 text-[10px] font-semibold text-neutral-900">
                  If found, please return to:
                </p>
                <p>{DOC_BRANDING.name}</p>
                <p className="text-neutral-500">{DOC_BRANDING.address}</p>
                <p className="mt-1">{DOC_BRANDING.contact}</p>
                {card.extra.guardianPhone && (
                  <p className="mt-1">Emergency: {card.extra.guardianPhone}</p>
                )}
                {card.extra.emergencyContact && (
                  <p className="mt-1">
                    Emergency: {card.extra.emergencyContact}
                  </p>
                )}
                {card.extra.warden && (
                  <p className="mt-1">Warden: {card.extra.warden}</p>
                )}
              </div>
              <div className="shrink-0">
                <QrToken
                  token={card.verificationToken}
                  size={64}
                  label="ID verification QR"
                />
              </div>
            </div>
            <div className="flex items-end justify-between">
              <BarcodeGlyph value={card.cardNumber} className="h-6 w-28" />
              <span className="text-[8px] text-neutral-400">
                Authorised Signatory
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
