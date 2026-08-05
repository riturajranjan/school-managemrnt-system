"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DetailDrawer } from "@/components/dashboard/detail-drawer";
import { Input, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import { addBehaviourNote } from "@/lib/services/students-service";
import type { BehaviourNote, Student } from "@/lib/types/students";
import { formatDateTime } from "@/lib/utils";

const typeTone: Record<BehaviourNote["type"], "success" | "warning" | "error"> = { positive: "success", concern: "warning", incident: "error" };

export function BehaviourTab({ student }: { student: Student }) {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<BehaviourNote["type"]>("positive");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");

  return (
    <div className="flex flex-col gap-md">
      {can("students.edit") && (
        <Button variant="outline" size="sm" className="self-start" onClick={() => setOpen(true)}>
          Add behaviour note
        </Button>
      )}

      {student.behaviourNotes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No behaviour notes recorded.</p>
      ) : (
        <ol className="flex flex-col gap-sm">
          {student.behaviourNotes.map((note) => (
            <li key={note.id} className="rounded-lg border border-border p-sm">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-foreground">{note.title}</p>
                <Badge tone={typeTone[note.type]}>{note.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{note.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.recordedBy} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}

      <DetailDrawer open={open} onOpenChange={setOpen} title="Add behaviour note" description="Recorded on the student's timeline">
        <div className="flex flex-col gap-sm">
          <div>
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as BehaviourNote["type"])}>
              <SelectTrigger aria-label="Note type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="positive">Positive</SelectItem>
                <SelectItem value="concern">Concern</SelectItem>
                <SelectItem value="incident">Incident</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="behaviour-title">Title</Label>
            <Input id="behaviour-title" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="behaviour-detail">Detail</Label>
            <Textarea id="behaviour-detail" rows={3} value={detail} onChange={(e) => setDetail(e.target.value)} />
          </div>
          <Button
            disabled={!title.trim()}
            onClick={() => {
              addBehaviourNote(student.id, { type, title: title.trim(), detail: detail.trim(), recordedBy: "Class Teacher" });
              setTitle("");
              setDetail("");
              setOpen(false);
            }}
          >
            Save note
          </Button>
        </div>
      </DetailDrawer>
    </div>
  );
}
