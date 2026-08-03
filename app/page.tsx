const semanticSwatches = [
  { label: "Success", bg: "bg-success", fg: "text-success-foreground" },
  { label: "Warning", bg: "bg-warning", fg: "text-warning-foreground" },
  { label: "Error", bg: "bg-error", fg: "text-error-foreground" },
  { label: "Info", bg: "bg-info", fg: "text-info-foreground" },
];

const chartSwatches = ["bg-chart-1", "bg-chart-2", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

// Temporary design-token preview rendered inside the real AppShell — verifies
// the theme foundation and shell layout together. Replaced by the real
// dashboard once widgets are built.
export default function Home() {
  return (
    <div className="flex flex-col gap-xl">
      <div>
        <h2 className="text-lg font-semibold">Theme &amp; token foundation</h2>
        <p className="text-sm text-muted-foreground">
          Light/dark tokens, shadows, glass, and 3D surfaces — rendered inside the app shell.
        </p>
      </div>

      <section className="grid grid-cols-2 gap-md sm:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface p-md shadow-card">
          <p className="text-sm font-medium">Surface card</p>
          <p className="text-xs text-muted-foreground">bg-surface + shadow-card</p>
        </div>
        <div className="surface-3d rounded-lg bg-surface p-md">
          <p className="text-sm font-medium">3D surface</p>
          <p className="text-xs text-muted-foreground">.surface-3d fallback</p>
        </div>
        <div className="glass rounded-lg p-md">
          <p className="text-sm font-medium">Glass panel</p>
          <p className="text-xs text-muted-foreground">.glass</p>
        </div>
      </section>

      <section className="flex flex-wrap gap-sm">
        <button className="rounded-pill bg-primary px-lg py-sm text-sm font-medium text-primary-foreground shadow-card">
          Primary
        </button>
        <button className="rounded-pill bg-secondary px-lg py-sm text-sm font-medium text-secondary-foreground">
          Secondary
        </button>
        <button className="rounded-pill bg-accent px-lg py-sm text-sm font-medium text-accent-foreground">
          Accent
        </button>
        <button className="rounded-pill border border-border bg-transparent px-lg py-sm text-sm font-medium text-foreground">
          Ghost
        </button>
      </section>

      <section className="grid grid-cols-2 gap-sm sm:grid-cols-4">
        {semanticSwatches.map(({ label, bg, fg }) => (
          <div key={label} className={`rounded-md ${bg} ${fg} px-md py-sm text-sm font-medium`}>
            {label}
          </div>
        ))}
      </section>

      <section className="flex items-center gap-sm">
        {chartSwatches.map((swatch) => (
          <span key={swatch} className={`size-8 rounded-md ${swatch}`} />
        ))}
      </section>

      <section className="flex flex-col gap-sm">
        <p className="text-sm font-medium">Loading state</p>
        <div className="skeleton h-4 w-2/3 rounded-sm" />
        <div className="skeleton h-4 w-1/2 rounded-sm" />
      </section>
    </div>
  );
}
