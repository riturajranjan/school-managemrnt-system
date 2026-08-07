import { cn } from "@/lib/utils";

/** Deterministic pseudo-barcode drawn from a token's char codes. Purely a
 * visual stand-in for a real Code-128 render — the encoded value is an opaque
 * secure identifier (barcode/QR token), never personal data. */
export function BarcodeGlyph({ value, className }: { value: string; className?: string }) {
  const bars = Array.from(value).flatMap((ch, i) => {
    const w = (ch.charCodeAt(0) % 3) + 1;
    return [{ w, filled: true }, { w: ((ch.charCodeAt(0) + i) % 2) + 1, filled: false }];
  });
  return (
    <div className={cn("flex h-10 items-stretch gap-[1px] bg-white p-1", className)} aria-hidden="true">
      {bars.map((b, i) => (
        <span key={i} style={{ width: b.w, background: b.filled ? "#000" : "transparent" }} />
      ))}
    </div>
  );
}

/** Deterministic QR-like matrix from a token hash. Same disclaimer — a visual
 * placeholder for a real QR, encoding an opaque token only. */
export function QrGlyph({ value, size = 84, className }: { value: string; size?: number; className?: string }) {
  const cells = 21;
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  const filled = (r: number, c: number) => {
    // Finder patterns in three corners.
    const inFinder = (br: number, bc: number) => r >= br && r < br + 7 && c >= bc && c < bc + 7 && (r === br || r === br + 6 || c === bc || c === bc + 6 || (r >= br + 2 && r <= br + 4 && c >= bc + 2 && c <= bc + 4));
    if (inFinder(0, 0) || inFinder(0, cells - 7) || inFinder(cells - 7, 0)) return true;
    if ((r < 8 && c < 8) || (r < 8 && c >= cells - 8) || (r >= cells - 8 && c < 8)) return false;
    return ((hash >> ((r * cells + c) % 31)) & 1) === 1;
  };
  return (
    <div className={cn("bg-white p-1", className)} style={{ width: size, height: size }} aria-hidden="true">
      <div className="grid h-full w-full" style={{ gridTemplateColumns: `repeat(${cells}, 1fr)`, gridTemplateRows: `repeat(${cells}, 1fr)` }}>
        {Array.from({ length: cells * cells }).map((_, i) => (
          <span key={i} style={{ background: filled(Math.floor(i / cells), i % cells) ? "#000" : "#fff" }} />
        ))}
      </div>
    </div>
  );
}
