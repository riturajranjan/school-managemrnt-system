import { QrGlyph } from "@/components/library/code-label";

/** Accessible QR placeholder. The visible matrix is decorative (aria-hidden in
 * QrGlyph); this wrapper adds a text alternative describing the opaque token —
 * never personal data. */
export function QrToken({ token, size = 84, label = "Verification QR code" }: { token: string; size?: number; label?: string }) {
  return (
    <span role="img" aria-label={`${label} (token ${token})`} className="inline-block">
      <QrGlyph value={token} size={size} />
      <span className="sr-only">Scan to verify document. Token {token}. Encodes an opaque verification token only — no personal data.</span>
    </span>
  );
}
