import { DashboardGrid } from "@/components/dashboard/dashboard-grid";

export default function Home() {
  return (
    <div className="flex flex-col gap-sm sm:gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">School Command Centre</h1>
        <p className="text-sm text-muted-foreground">A live view of today&apos;s school operations.</p>
      </div>
      <DashboardGrid />
    </div>
  );
}
