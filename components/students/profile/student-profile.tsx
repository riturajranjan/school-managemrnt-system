"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TimelineList } from "@/components/timeline/timeline-list";
import { useStudent } from "@/lib/hooks/use-students";
import { addStudentNote } from "@/lib/services/students-service";
import { StudentHeader } from "./student-header";
import { OverviewTab } from "./tabs/overview-tab";
import { AcademicsTab } from "./tabs/academics-tab";
import { AttendanceTab } from "./tabs/attendance-tab";
import { FeesTab } from "./tabs/fees-tab";
import { BehaviourTab } from "./tabs/behaviour-tab";
import { HealthTab } from "./tabs/health-tab";
import { StudentDocumentsTab } from "./tabs/documents-tab";
import { TransportTab } from "./tabs/transport-tab";
import { LibraryTab } from "./tabs/library-tab";
import { StudentCommunicationTab } from "./tabs/communication-tab";
import { CertificatesTab } from "./tabs/certificates-tab";

export function StudentProfile({ studentId, initialTab = "overview" }: { studentId: string; initialTab?: string }) {
  const student = useStudent(studentId);
  const [activeTab, setActiveTab] = useState(initialTab);

  if (!student) {
    return (
      <div className="flex flex-col items-center gap-sm py-2xl text-center">
        <p className="text-sm font-medium text-foreground">Student not found</p>
        <Button asChild variant="outline">
          <Link href="/students">Back to Students</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-md pb-20 sm:pb-0">
      <StudentHeader student={student} onUploadDocument={() => setActiveTab("documents")} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="academics">Academics</TabsTrigger>
          <TabsTrigger value="attendance">Attendance</TabsTrigger>
          <TabsTrigger value="fees">Fees</TabsTrigger>
          <TabsTrigger value="behaviour">Behaviour</TabsTrigger>
          <TabsTrigger value="health">Health</TabsTrigger>
          <TabsTrigger value="documents">Documents</TabsTrigger>
          <TabsTrigger value="transport">Transport</TabsTrigger>
          <TabsTrigger value="library">Library</TabsTrigger>
          <TabsTrigger value="communication">Communication</TabsTrigger>
          <TabsTrigger value="certificates">Certificates</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-md">
          <OverviewTab student={student} />
        </TabsContent>
        <TabsContent value="academics" className="mt-md">
          <AcademicsTab student={student} />
        </TabsContent>
        <TabsContent value="attendance" className="mt-md">
          <AttendanceTab student={student} />
        </TabsContent>
        <TabsContent value="fees" className="mt-md">
          <FeesTab student={student} />
        </TabsContent>
        <TabsContent value="behaviour" className="mt-md">
          <BehaviourTab student={student} />
        </TabsContent>
        <TabsContent value="health" className="mt-md">
          <HealthTab student={student} />
        </TabsContent>
        <TabsContent value="documents" className="mt-md">
          <StudentDocumentsTab student={student} />
        </TabsContent>
        <TabsContent value="transport" className="mt-md">
          <TransportTab student={student} />
        </TabsContent>
        <TabsContent value="library" className="mt-md">
          <LibraryTab />
        </TabsContent>
        <TabsContent value="communication" className="mt-md">
          <StudentCommunicationTab student={student} />
        </TabsContent>
        <TabsContent value="certificates" className="mt-md">
          <CertificatesTab student={student} />
        </TabsContent>
        <TabsContent value="timeline" className="mt-md">
          <TimelineList events={student.timeline} onAddNote={(body) => addStudentNote(student.id, body, "Staff")} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
