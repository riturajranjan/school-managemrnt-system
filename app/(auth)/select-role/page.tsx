import { redirect } from "next/navigation";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { requireUser } from "@/lib/server/context";
import { deriveContextChoices } from "@/lib/server/auth/onboarding";
import { selectRoleAction } from "@/lib/server/actions/setup";

// Real role selection. Roles come from the user's actual role assignments —
// never a mock account. selectRoleAction validates the choice server-side; the
// client can never submit an arbitrary role string and gain access.
export default async function SelectRolePage() {
  const user = await requireUser();
  const choices = await deriveContextChoices(user.id);
  if (!choices) redirect("/access-denied");
  if (choices.roles.length <= 1) redirect("/");

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Continue as" subtitle={`You have ${choices.roles.length} roles.`} />
        <form className="flex flex-col gap-2">
          {choices.roles.map((r) => (
            <button
              key={r.roleId} type="submit" formAction={selectRoleAction} name="roleId" value={r.roleId}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary/50"
            >
              <Avatar text={r.roleName.slice(0, 2)} color="#0891b2" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{r.roleName}</span>
                <span className="block truncate text-xs text-muted-foreground">Sign in with this role</span>
              </span>
            </button>
          ))}
        </form>
        <AuthLinkRow><AuthLink href="/login">Sign in as someone else</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
