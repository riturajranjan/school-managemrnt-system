"use client";

import Link from "next/link";
import { useState } from "react";
import { Plus } from "lucide-react";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { roomById, teacherById } from "@/lib/data/seed/academics";
import { useManagedClasses, useTeachers } from "@/lib/hooks/use-academics";
import { addSection, assignClassTeacher } from "@/lib/services/academics-service";

export default function SectionsPage() {
  const classes = useManagedClasses();
  const teachers = useTeachers();
  const { can } = usePermissions();
  const [addOpen, setAddOpen] = useState(false);
  const [classId, setClassId] = useState("");
  const [name, setName] = useState("");
  const [capacity, setCapacity] = useState("32");

  const rows = classes.flatMap((c) => c.sections.map((s) => ({ schoolClass: c, section: s })));

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <div className="flex flex-col gap-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Sections</h1>
          <p className="text-xs text-muted-foreground">Every section across all classes</p>
        </div>
        {can("academics.manageClasses") && (
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" />
            Add section
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-sm">
        {rows.map(({ schoolClass, section }) => (
          <div key={section.id} className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-sm sm:flex-row sm:items-center sm:justify-between">
            <div>
              <Link href={`/academics/classes/${schoolClass.id}`} className="text-sm font-medium text-foreground hover:underline">
                {schoolClass.name} — Section {section.name}
              </Link>
              <p className="text-xs text-muted-foreground">
                {section.enrolledCount}/{section.capacity} students · {roomById(section.roomId)?.name ?? "No room set"} · {section.shift}
              </p>
            </div>
            <div className="flex items-center gap-sm">
              {can("academics.manageClasses") ? (
                <Select value={section.classTeacherId ?? ""} onValueChange={(v) => assignClassTeacher(schoolClass.id, section.id, v)}>
                  <SelectTrigger className="w-48" aria-label="Class teacher">
                    <SelectValue placeholder="Assign class teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <Badge tone="neutral">{teacherById(section.classTeacherId)?.name ?? "Unassigned"}</Badge>
              )}
            </div>
          </div>
        ))}
      </div>

      <DetailDrawer open={addOpen} onOpenChange={setAddOpen} title="Add section" description="Create a new section within a class">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger aria-label="Class">
                <SelectValue placeholder="Select class" />
              </SelectTrigger>
              <SelectContent>
                {classes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="section-name">Section name</Label>
            <Input id="section-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. C" />
          </div>
          <div>
            <Label htmlFor="section-capacity">Capacity</Label>
            <Input id="section-capacity" type="number" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
          </div>
          <Button
            disabled={!classId || !name.trim()}
            onClick={() => {
              addSection(classId, name.trim(), Number(capacity) || 32);
              setAddOpen(false);
              setName("");
              setClassId("");
            }}
          >
            Add section
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
