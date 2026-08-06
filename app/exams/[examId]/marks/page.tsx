"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ExamMarksRedirectPage() {
  const params = useParams<{ examId: string }>();
  const router = useRouter();

  useEffect(() => {
    router.replace(`/marks/entry?examId=${params.examId}`);
  }, [params.examId, router]);

  return <div className="h-40" />;
}
