import { StudentProfile } from "@/components/students/profile/student-profile";

export default async function StudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StudentProfile studentId={studentId} />;
}
