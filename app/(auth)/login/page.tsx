// Server wrapper: if already authenticated, skip the login form and send the
// user to their simple landing route (Batch 2, item 14). Otherwise render the
// existing login UI unchanged, forwarding a validated `returnTo` from the URL.
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/server/auth/current-user";
import { sanitizeReturnTo } from "@/lib/server/auth/routes";
import { resolvePostLogin } from "@/lib/server/context/resolver";
import { LoginView } from "./login-view";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const user = await getCurrentUser();
  if (user) redirect(await resolvePostLogin(user.id));

  const { returnTo } = await searchParams;
  const safeReturnTo = sanitizeReturnTo(typeof returnTo === "string" ? returnTo : null);
  return <LoginView returnTo={safeReturnTo} />;
}
