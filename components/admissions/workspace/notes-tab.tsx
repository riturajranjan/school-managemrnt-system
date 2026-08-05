"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { addApplicationNote } from "@/lib/services/admissions-service";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { formatDateTime } from "@/lib/utils";

export function NotesTab({ application }: { application: AdmissionApplication }) {
  const [body, setBody] = useState("");

  return (
    <div className="flex flex-col gap-md">
      <div className="flex flex-col gap-xs rounded-lg border border-border p-sm">
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Add an internal note (not visible to parents)…" rows={3} />
        <Button
          size="sm"
          className="self-end"
          disabled={!body.trim()}
          onClick={() => {
            addApplicationNote(application.id, body.trim(), "Admission Officer", "Admission Officer");
            setBody("");
          }}
        >
          Add note
        </Button>
      </div>

      {application.notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No internal notes yet.</p>
      ) : (
        <ol className="flex flex-col gap-sm">
          {application.notes.map((note) => (
            <li key={note.id} className="rounded-md border border-border p-sm text-sm">
              <p className="text-foreground">{note.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {note.authorName} · {note.authorRole} · {formatDateTime(note.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
