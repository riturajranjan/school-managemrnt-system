// Server wrapper for the platform sign-in page. Redirects already-authenticated
// users to their simple landing route (Batch 2, item 14); otherwise renders the
// existing platform login UI unchanged.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { resolvePostLogin } from "@/lib/server/context/resolver";
import { SuperAdminLoginView } from "./super-admin-view";

export default async function SuperAdminLoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(await resolvePostLogin(user.id));
  return <SuperAdminLoginView />;
}
