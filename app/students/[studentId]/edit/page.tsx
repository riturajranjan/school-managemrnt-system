import { StudentEditForm } from "@/components/students/profile/student-edit-form";

export default async function StudentEditPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  return <StudentEditForm studentId={studentId} />;
}
