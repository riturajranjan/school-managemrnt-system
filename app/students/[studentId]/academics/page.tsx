import { StudentProfile } from "@/components/students/profile/student-profile";

export default async function StudentAcademicsPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StudentProfile studentId={studentId} initialTab="academics" />;
}
