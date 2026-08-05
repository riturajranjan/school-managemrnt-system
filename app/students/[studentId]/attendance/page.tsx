import { StudentProfile } from "@/components/students/profile/student-profile";

export default async function StudentAttendancePage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StudentProfile studentId={studentId} initialTab="attendance" />;
}
