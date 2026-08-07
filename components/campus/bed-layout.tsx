import { BedDouble } from "lucide-react";
import { bedStatusLabels, bedStatusTone, type HostelBed } from "@/lib/types/hostel";
import { toneClasses } from "@/components/dashboard/tone";
import { cn } from "@/lib/utils";

/** Compact dimensional bed layout for a room. Each bed is a raised card; the
 * occupant name (or status) shows below. No photorealistic bedroom. */
export function BedLayout({ beds, studentName, onBedClick }: { beds: HostelBed[]; studentName: (id?: string) => string; onBedClick?: (bed: HostelBed) => void }) {
  return (
    <div className="flex flex-wrap gap-sm">
      {beds.map((bed) => {
        const tone = bedStatusTone[bed.status];
        const Wrapper = onBedClick ? "button" : "div";
        return (
          <Wrapper
            key={bed.id}
            {...(onBedClick ? { type: "button" as const, onClick: () => onBedClick(bed) } : {})}
            className={cn("surface-3d flex w-28 flex-col items-center gap-1 rounded-lg border border-border bg-surface p-sm text-center", onBedClick && "outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring [@media(hover:hover)]:hover:-translate-y-0.5")}
          >
            <span className={cn("flex size-9 items-center justify-center rounded-md", toneClasses[tone].soft)}>
              <BedDouble className="size-4" />
            </span>
            <span className="text-sm font-semibold text-foreground">Bed {bed.position}</span>
            <span className="w-full truncate text-xs text-muted-foreground">{bed.status === "occupied" ? studentName(bed.studentId) : bedStatusLabels[bed.status]}</span>
          </Wrapper>
        );
      })}
    </div>
  );
}
