"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { usePermissions } from "@/components/providers/permissions-provider";
import { sendApplicationCommunication } from "@/lib/services/admissions-service";
import type { AdmissionApplication } from "@/lib/types/admissions";
import { formatDateTime } from "@/lib/utils";

export function CommunicationTab({ application }: { application: AdmissionApplication }) {
  const { can } = usePermissions();
  const [channel, setChannel] = useState<"email" | "sms" | "whatsapp">("whatsapp");
  const [body, setBody] = useState("");
  const messages = application.timeline.filter((e) => e.category === "communication");

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
            <span className="text-xs text-muted-foreground">to {application.guardians.find((g) => g.isPrimary)?.firstName ?? "guardian"}</span>
          </div>
          <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" rows={3} />
          <Button
            size="sm"
            className="self-end"
            disabled={!body.trim()}
            onClick={() => {
              sendApplicationCommunication(application.id, channel, body.trim(), "Admission Officer");
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
                {m.title} · {formatDateTime(m.createdAt)} · {m.actorName}
              </p>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
