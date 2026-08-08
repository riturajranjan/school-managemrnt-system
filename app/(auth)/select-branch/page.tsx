import { redirect } from "next/navigation";
import { MapPin } from "lucide-react";
import { AuthCard, AuthCenter, AuthHeader } from "@/components/auth/auth-shell";
import { Avatar } from "@/components/auth/selectors";
import { AuthLink, AuthLinkRow } from "@/components/auth/misc";
import { requireUser } from "@/lib/server/context";
import { deriveContextChoices } from "@/lib/server/auth/onboarding";
import { selectBranchAction } from "@/lib/server/actions/setup";

// Real branch selection. Only branches the user is actually authorized for (via
// their role scopes / accessible schools) are shown. selectBranchAction
// validates the choice against those before persisting.
export default async function SelectBranchPage() {
  const user = await requireUser();
  const choices = await deriveContextChoices(user.id);
  if (!choices) redirect("/access-denied");
  if (choices.branches.length <= 1) redirect("/");

  return (
    <AuthCenter>
      <AuthCard>
        <AuthHeader title="Choose a branch" subtitle="Select where to work." />
        <form className="flex flex-col gap-2">
          {choices.branches.map((b) => (
            <button
              key={b.id} type="submit" formAction={selectBranchAction} name="branchId" value={b.id}
              className="flex w-full items-center gap-3 rounded-xl border border-border bg-surface p-3 text-left transition hover:border-primary/50"
            >
              <Avatar text={b.name.slice(0, 2)} color="#022c43" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{b.name}</span>
                <span className="flex items-center gap-1 truncate text-xs text-muted-foreground"><MapPin className="size-3" /> {b.code}</span>
              </span>
            </button>
          ))}
        </form>
        <AuthLinkRow><AuthLink href="/select-school">Change school</AuthLink></AuthLinkRow>
      </AuthCard>
    </AuthCenter>
  );
}
