"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DriverLandingPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/driver/today");
  }, [router]);
  return null;
}
