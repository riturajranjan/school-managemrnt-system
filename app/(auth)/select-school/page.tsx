import { redirect } from "next/navigation";
import { Star } from "lucide-react";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { requireUser } from "@/lib/server/context";
import { deriveContextChoices } from "@/lib/server/auth/onboarding";
import { selectSchoolAction } from "@/lib/server/actions/setup";

// Real school selection. Schools come from the signed-in user's actual tenant
// membership + role scopes — never a mock list. Selection is validated
// server-side by selectSchoolAction, which then routes onward via the resolver.
export default async function SelectSchoolPage() {
  const user = await requireUser();
  const choices = await deriveContextChoices(user.id);
  if (!choices) redirect("/access-denied");
  // A single-school user shouldn't be here — send them onward.
  if (choices.schools.length <= 1) redirect("/");

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Choose a school" subtitle="You have access to multiple schools." />
        <form className="flex flex-col gap-2">
          {choices.schools.map((s) => (
            <button
              key={s.id} type="submit" formAction={selectSchoolAction} name="schoolId" value={s.id}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary/50"
            >
              <Avatar text={s.code.slice(0, 2)} color="#0891b2" />
              <span className="min-w-0">
                <span className="flex items-center gap-1 truncate text-sm font-medium text-foreground">{s.name} <Star className="size-3 fill-warning text-warning" /></span>
                <span className="block truncate text-xs text-muted-foreground">{s.code}</span>
              </span>
            </button>
          ))}
        </form>
        <AuthLinkRow><AuthLink href="/login">Back to sign-in</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
