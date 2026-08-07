"use client";

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePermissions } from "@/components/providers/permissions-provider";
import {
  recordInterviewResult,
  scheduleInterview,
} from "@/lib/services/admissions-service";
import type {
  AdmissionApplication,
  AdmissionInterviewResult,
} from "@/lib/types/admissions";
import { formatDateTime } from "@/lib/utils";

export function InterviewTab({
  application,
}: {
  application: AdmissionApplication;
}) {
  const { can } = usePermissions();
  const [scheduledAt, setScheduledAt] = useState("");
  const [interviewerName, setInterviewerName] = useState("Principal");
  const [mode, setMode] = useState<"in-person" | "video" | "phone">(
    "in-person",
  );
  const [resultNotes, setResultNotes] = useState("");

  const interview = application.interview;

  if (!interview) {
    return (
      <div className="flex  flex-col gap-sm rounded-lg border border-border p-md">
        <p className="text-sm text-muted-foreground">
          No interview scheduled yet.
        </p>
        {can("admissions.edit") && (
          <>
            <div>
              <Label htmlFor="interview-slot">Date & time</Label>
              <Input
                id="interview-slot"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="interviewer">Interviewer</Label>
              <Input
                id="interviewer"
                value={interviewerName}
                onChange={(e) => setInterviewerName(e.target.value)}
              />
            </div>
            <div>
              <Label>Mode</Label>
              <Select
                value={mode}
                onValueChange={(v) => setMode(v as typeof mode)}>
                <SelectTrigger aria-label="Interview mode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in-person">In person</SelectItem>
                  <SelectItem value="video">Video call</SelectItem>
                  <SelectItem value="phone">Phone call</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              disabled={!scheduledAt}
              onClick={() =>
                scheduleInterview(
                  application.id,
                  {
                    scheduledAt: new Date(scheduledAt).toISOString(),
                    interviewerName,
                    mode,
                  },
                  "Admission Officer",
                )
              }>
              Schedule interview
            </Button>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex  flex-col gap-sm rounded-lg border border-border p-md">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-foreground">
          {formatDateTime(interview.scheduledAt)}
        </p>
        <Badge
          tone={
            interview.status === "completed"
              ? "success"
              : interview.status === "cancelled"
                ? "error"
                : "info"
          }>
          {interview.status}
        </Badge>
      </div>
      <p className="text-xs text-muted-foreground">
        {interview.interviewerName} · {interview.mode.replace("-", " ")}
      </p>
      {interview.result && (
        <Badge
          tone={
            interview.result === "recommended"
              ? "success"
              : interview.result === "waitlist"
                ? "warning"
                : "error"
          }>
          {interview.result.replace("-", " ")}
        </Badge>
      )}
      {interview.notes && (
        <p className="text-sm text-muted-foreground">{interview.notes}</p>
      )}

      {interview.status === "scheduled" && can("admissions.edit") && (
        <div className="flex flex-col gap-xs border-t border-border pt-sm">
          <Label htmlFor="result-notes">Interview notes</Label>
          <Input
            id="result-notes"
            value={resultNotes}
            onChange={(e) => setResultNotes(e.target.value)}
            placeholder="Panel notes…"
          />
          <div className="flex flex-wrap gap-xs">
            {(
              [
                "recommended",
                "waitlist",
                "not-recommended",
              ] as AdmissionInterviewResult[]
            ).map((result) => (
              <Button
                key={result}
                size="sm"
                variant="outline"
                onClick={() =>
                  recordInterviewResult(
                    application.id,
                    result,
                    resultNotes,
                    "Principal",
                  )
                }>
                {result.replace("-", " ")}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
