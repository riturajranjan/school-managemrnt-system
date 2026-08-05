"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { sendStudentCommunication } from "@/lib/services/students-service";
import type { Student } from "@/lib/types/students";
import { formatDateTime } from "@/lib/utils";

export function StudentCommunicationTab({ student }: { student: Student }) {
  const { can } = usePermissions();
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("whatsapp");
  const [body, setBody] = useState("");
  const messages = student.timeline.filter((e) => e.category === "communication");

  return (
    <div className="flex flex-col gap-md">
      {can("communication.send") && (
        <div className="flex flex-col gap-sm rounded-lg border border-border p-sm">
          <div className="flex items-center gap-sm">
            <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
              <SelectTrigger className="w-36" aria-label="Channel">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="email">Email</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-xs text-muted-foreground">to parent</span>
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={3} placeholder="Write a message…" />
          <Button
            size="sm"
            className="self-end"
            disabled={!body.trim()}
            onClick={() => {
              sendStudentCommunication(student.id, channel, body.trim(), "Staff");
              setBody("");
            }}
          >
            <Send className="size-3.5" />
            Send
          </Button>
        </div>
      )}

      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">No messages sent yet.</p>
      ) : (
        <ol className="flex flex-col gap-sm">
          {messages.map((m) => (
            <li key={m.id} className="rounded-md border border-border p-sm text-sm">
              <p className="text-foreground">{m.detail}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {m.title} · {formatDateTime(m.createdAt)}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
