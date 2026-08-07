"use client";

/** Lightweight functional campus navigation — CSS/SVG isometric-ish blocks, no
 * WebGL. Highlights the selected destination so a visitor knows where to go. */
const DESTINATIONS = [
  { key: "reception", label: "Reception", x: 1, y: 2, tone: "#18b0c8" },
  { key: "principal", label: "Principal Office", x: 3, y: 0, tone: "#7c3aed" },
  { key: "administration", label: "Administration", x: 2, y: 1, tone: "#0f766e" },
  { key: "accounts", label: "Accounts", x: 4, y: 1, tone: "#b45309" },
  { key: "library", label: "Library", x: 0, y: 0, tone: "#047857" },
  { key: "auditorium", label: "Auditorium", x: 4, y: 3, tone: "#be123c" },
  { key: "labs", label: "Labs", x: 2, y: 3, tone: "#1d4ed8" },
  { key: "sports", label: "Sports", x: 0, y: 3, tone: "#0f766e" },
  { key: "meeting", label: "Meeting Rooms", x: 3, y: 2, tone: "#022c43" },
];

export function CampusMap({ highlight }: { highlight?: string }) {
  const h = (highlight ?? "").toLowerCase();
  return (
    <div className="overflow-x-auto">
      <div className="relative grid min-w-[420px] grid-cols-5 grid-rows-4 gap-2 rounded-lg border border-border bg-surface-secondary/30 p-md" style={{ aspectRatio: "5 / 4" }} aria-label="Campus map">
        {DESTINATIONS.map((d) => {
          const active = h.includes(d.key) || d.label.toLowerCase().includes(h);
          return (
            <div
              key={d.key}
              className="flex items-end justify-center rounded-md border p-1 text-center text-[10px] font-medium shadow-card transition-transform"
              style={{
                gridColumn: d.x + 1,
                gridRow: d.y + 1,
                background: `linear-gradient(160deg, ${d.tone}22, ${d.tone}11)`,
                borderColor: active ? d.tone : "var(--color-border)",
                transform: active ? "translateY(-2px) scale(1.03)" : undefined,
                color: active ? d.tone : "var(--color-muted-foreground)",
                outline: active ? `2px solid ${d.tone}` : undefined,
              }}
            >
              {d.label}
            </div>
          );
        })}
      </div>
    </div>
  );
}
