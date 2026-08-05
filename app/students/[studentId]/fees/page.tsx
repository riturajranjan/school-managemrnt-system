import { StudentProfile } from "@/components/students/profile/student-profile";

export default async function StudentFeesPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StudentProfile studentId={studentId} initialTab="fees" />;
}
