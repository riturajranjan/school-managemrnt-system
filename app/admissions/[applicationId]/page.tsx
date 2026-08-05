import { ApplicantWorkspace } from "@/components/admissions/workspace/applicant-workspace";

export default async function ApplicantPage({ params }: { params: Promise<{ applicationId: string }> }) {
  const { applicationId } = await params;
  return <ApplicantWorkspace applicationId={applicationId} />;
}
