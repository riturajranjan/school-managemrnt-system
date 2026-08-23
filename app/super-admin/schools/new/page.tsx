"use client";

// Real "Create school" provisioning form (Super Admin SA-2). Submits to the
// transactional POST /api/super-admin/schools — no mock store, no simulation.
// The elaborate multi-step onboarding wizard (/super-admin/onboarding) remains a
// separate mock surface owned by SA-3.
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, Building2 } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { FieldError, Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { provisionSchoolRequest } from "@/lib/hooks/api/use-platform-schools";

// Client validation is UX only — the server re-validates authoritatively. Emails
// are validated with the non-deprecated z.email() and stored/sent as plain
// strings (no markdown/mailto formatting).
const schema = z.object({
  name: z.string().trim().min(1, "School name is required"),
  code: z.string().trim().min(1, "Code is required"),
  email: z.union([z.literal(""), z.email("Enter a valid email")]),
  phone: z.string().optional().or(z.literal("")),
  schoolType: z.string().optional().or(z.literal("")),
  board: z.string().optional().or(z.literal("")),
  sessionName: z.string().trim().min(1, "Session name is required"),
  startDate: z.string().min(1, "Start date is required"),
  endDate: z.string().min(1, "End date is required"),
  adminFirstName: z.string().trim().min(1, "Admin first name is required"),
  adminLastName: z.string().trim().min(1, "Admin last name is required"),
  adminEmail: z.email("Enter a valid admin email"),
});
type Values = z.infer<typeof schema>;

export default function NewSchoolPage() {
  const router = useRouter();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Phase 9W.2 — the setup link is single-use and returned exactly once here;
  // there is nowhere else to retrieve it later, so it must be shown before
  // navigating away.
  const [setupLink, setSetupLink] = useState<{ schoolId: string; url: string | null } | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({
    resolver: zodResolver(schema),
  });
  const errors = formState.errors;

  async function onSubmit(values: Values) {
    setSubmitError(null);
    setSubmitting(true);
    // Normalize emails to plain, trimmed, lowercase strings before sending.
    const schoolEmail = values.email.trim().toLowerCase();
    const adminEmail = values.adminEmail.trim().toLowerCase();
    const res = await provisionSchoolRequest({
      school: {
        name: values.name.trim(),
        code: values.code.trim(),
        email: schoolEmail || undefined,
        phone: values.phone?.trim() || undefined,
        schoolType: values.schoolType?.trim() || undefined,
        board: values.board?.trim() || undefined,
      },
      academicSession: {
        name: values.sessionName.trim(),
        startDate: values.startDate,
        endDate: values.endDate,
      },
      admin: {
        firstName: values.adminFirstName.trim(),
        lastName: values.adminLastName.trim(),
        email: adminEmail,
      },
    });
    setSubmitting(false);
    if (!res.success) {
      setSubmitError(res.error.message);
      return;
    }
    setSetupLink({ schoolId: res.data.schoolId, url: res.data.adminPasswordSetupUrl });
  }

  if (setupLink) {
    return (
      <div className="mx-auto flex max-w-lg flex-col gap-md pb-20 sm:pb-0">
        <h1 className="text-lg font-semibold text-foreground">School created</h1>
        {setupLink.url ? (
          <div className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md text-sm">
            <p className="text-muted-foreground">No email was sent — password setup is pending. Share this link securely with the School Administrator:</p>
            <code className="break-all rounded bg-muted px-2 py-1 text-xs">{setupLink.url}</code>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">This admin email already had an active account — no new setup is needed.</p>
        )}
        <Button size="md" onClick={() => router.push(`/super-admin/schools/${setupLink.schoolId}`)}>Continue to school</Button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex  flex-col gap-md pb-20 sm:pb-0">
      <div className="flex items-center gap-2">
        <Button asChild size="sm" variant="ghost">
          <Link href="/super-admin/schools">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <Building2 className="size-5 text-primary" /> Create school
        </h1>
      </div>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex flex-col gap-md rounded-lg border border-border bg-surface p-md">
        {submitError && (
          <p className="rounded-md border border-error/30 bg-error/10 p-sm text-xs text-error">
            {submitError}
          </p>
        )}

        <section className="flex flex-col gap-sm">
          <h2 className="text-sm font-semibold text-foreground">School</h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="name">School name *</Label>
              <Input
                id="name"
                {...register("name")}
                aria-invalid={!!errors.name}
              />
              <FieldError>{errors.name?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="code">Code *</Label>
              <Input
                id="code"
                {...register("code")}
                aria-invalid={!!errors.code}
              />
              <FieldError>{errors.code?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                {...register("email")}
                aria-invalid={!!errors.email}
              />
              <FieldError>{errors.email?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...register("phone")} />
            </div>
            <div>
              <Label htmlFor="schoolType">Type</Label>
              <Input
                id="schoolType"
                placeholder="K-12"
                {...register("schoolType")}
              />
            </div>
            <div>
              <Label htmlFor="board">Board</Label>
              <Input id="board" placeholder="CBSE" {...register("board")} />
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-sm border-t border-border pt-md">
          <h2 className="text-sm font-semibold text-foreground">
            First academic session
          </h2>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <div>
              <Label htmlFor="sessionName">Name *</Label>
              <Input
                id="sessionName"
                placeholder="2026-27"
                {...register("sessionName")}
                aria-invalid={!!errors.sessionName}
              />
              <FieldError>{errors.sessionName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="startDate">Start *</Label>
              <Input
                id="startDate"
                type="date"
                {...register("startDate")}
                aria-invalid={!!errors.startDate}
              />
              <FieldError>{errors.startDate?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="endDate">End *</Label>
              <Input
                id="endDate"
                type="date"
                {...register("endDate")}
                aria-invalid={!!errors.endDate}
              />
              <FieldError>{errors.endDate?.message}</FieldError>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-sm border-t border-border pt-md">
          <h2 className="text-sm font-semibold text-foreground">
            Initial school admin
          </h2>
          <p className="text-xs text-muted-foreground">
            The admin is created as{" "}
            <span className="font-medium text-foreground">
              invitation pending
            </span>{" "}
            — they set their password via the future invite flow. No email is
            sent yet.
          </p>
          <div className="grid grid-cols-1 gap-sm sm:grid-cols-3">
            <div>
              <Label htmlFor="adminFirstName">First name *</Label>
              <Input
                id="adminFirstName"
                {...register("adminFirstName")}
                aria-invalid={!!errors.adminFirstName}
              />
              <FieldError>{errors.adminFirstName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="adminLastName">Last name *</Label>
              <Input
                id="adminLastName"
                {...register("adminLastName")}
                aria-invalid={!!errors.adminLastName}
              />
              <FieldError>{errors.adminLastName?.message}</FieldError>
            </div>
            <div>
              <Label htmlFor="adminEmail">Email *</Label>
              <Input
                id="adminEmail"
                type="email"
                {...register("adminEmail")}
                aria-invalid={!!errors.adminEmail}
              />
              <FieldError>{errors.adminEmail?.message}</FieldError>
            </div>
          </div>
        </section>

        <div className="flex justify-end gap-sm border-t border-border pt-md">
          <Button
            type="button"
            variant="outline"
            disabled={submitting}
            onClick={() => router.push("/super-admin/schools")}>
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Provisioning…" : "Create school"}
          </Button>
        </div>
      </form>
    </div>
  );
}
