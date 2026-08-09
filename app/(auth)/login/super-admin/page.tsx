// Server wrapper for the platform sign-in page. Redirects already-authenticated
// users to their simple landing route (Batch 2, item 14); otherwise renders the
// existing platform login UI unchanged.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { landingForLogin } from "@/lib/server/auth/service";
import { SuperAdminLoginView } from "./super-admin-view";

export default async function SuperAdminLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(landingForLogin(user.isPlatformAdmin));
  return <SuperAdminLoginView />;
}
