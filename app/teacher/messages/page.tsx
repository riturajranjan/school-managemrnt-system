"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/input";
import { CURRENT_TEACHER_ID } from "@/lib/current-user";
import { useSisStore } from "@/lib/hooks/use-store";
import { sendStudentCommunication } from "@/lib/services/students-service";
import { formatDateTime } from "@/lib/utils";

export default function TeacherMessagesPage() {
  const db = useSisStore();
  const mySections = [...new Set(db.subjectAssignments.filter((a) => a.primaryTeacherId === CURRENT_TEACHER_ID).map((a) => a.sectionId))];
  const myStudents = db.students.filter((s) => mySections.includes(s.sectionId));

  const [studentId, setStudentId] = useState(myStudents[0]?.id ?? "");
  const [channel, setChannel] = useState<"whatsapp" | "sms" | "email">("whatsapp");
  const [body, setBody] = useState("");

  const recentMessages = myStudents
    .flatMap((s) => s.timeline.filter((e) => e.category === "communication").map((e) => ({ ...e, studentName: `${s.profile.firstName} ${s.profile.lastName}` })))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10);

  return (
    <div className="flex flex-col gap-md">
      <div>
        <h1 className="text-lg font-semibold text-foreground">Messages</h1>
        <p className="text-xs text-muted-foreground">Send updates to parents of your students</p>
      </div>

      <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
        <Select value={studentId} onValueChange={setStudentId}>
          <SelectTrigger aria-label="Student">
            <SelectValue placeholder="Select student" />
          </SelectTrigger>
          <SelectContent>
            {myStudents.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.profile.firstName} {s.profile.lastName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={channel} onValueChange={(v) => setChannel(v as typeof channel)}>
          <SelectTrigger className="w-40" aria-label="Channel">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="whatsapp">WhatsApp</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
            <SelectItem value="email">Email</SelectItem>
          </SelectContent>
        </Select>
        <Textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write a message…" rows={3} />
        <Button
          className="self-start"
          disabled={!body.trim() || !studentId}
          onClick={() => {
            sendStudentCommunication(studentId, channel, body.trim(), "Teacher");
            setBody("");
          }}
        >
          <Send className="size-3.5" />
          Send
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-surface p-md">
        <h2 className="mb-sm text-sm font-semibold text-foreground">Recent messages</h2>
        {recentMessages.length === 0 ? (
          <p className="text-sm text-muted-foreground">No messages sent yet.</p>
        ) : (
          <ul className="flex flex-col gap-sm">
            {recentMessages.map((m) => (
              <li key={m.id} className="rounded-md border border-border p-sm text-sm">
                <p className="text-foreground">{m.detail}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {m.studentName} · {formatDateTime(m.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
