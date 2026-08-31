"use client";

// Create Account — redesigned into clear, scannable sections (User & Access
// UX pass). Same real POST /api/users/provision flow throughout; every
// target role offered comes from GET /api/users/provisionable-roles (server
// policy), never a hardcoded list — backend authorization remains the source
// of truth regardless of what this page shows or hides. Two creation modes
// per target role: link an existing unlinked Staff/Student/Guardian record,
// or create one inline (reuses the real createStaff/createStudent/guardian-
// link services server-side — see lib/server/users/provisioning.ts).
//
// Deliberately OMITTED, with reasons (never faked — see AGENTS.md "no mock
// business data"):
//   - "Additional Permissions" / "Permission Groups": no per-user permission
//     override model exists (RolePermission is role-level only).
//   - A "School" picker: OrgScope is single-school per session — there is
//     only ever one real school to assign to, shown read-only.
//   - "Multiple Branches": no Staff/Student model supports more than one
//     branchId. Branch is a single real select only where the underlying
//     schema actually accepts one (Student); shown read-only for Staff
//     (whose branch is derived from session scope, not client-settable).
//   - Department/Designation: real fields, but only rendered once the
//     school's real Department/Designation lists are non-empty — never an
//     empty or hardcoded dropdown.
//   - Direct file upload for Profile Photo: no binary storage exists in this
//     system. Photo is a real photoUrl field (Student/Guardian only — Staff
//     has no such column) — a URL input with a live preview, not a fake
//     drag-and-drop.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Building2,
  ImagePlus,
  KeyRound,
  ShieldCheck,
  User as UserIcon,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  PasswordInput,
  PasswordStrengthMeter,
  passwordStrength,
} from "@/components/ui/password-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { apiGet } from "@/lib/api/client";
import { useApiResource } from "@/lib/hooks/api/use-api";
import {
  useProvisionAccount,
  useProvisionableRoles,
  type NewGuardianInput,
  type NewStaffInput,
  type NewStudentInput,
} from "@/lib/hooks/api/use-users-api";
import { useDepartments, useDesignations } from "@/lib/hooks/api/use-hr-api";

const STAFF_LINKED_ROLES = new Set([
  "PRINCIPAL",
  "VICE_PRINCIPAL",
  "TEACHER",
  "HR_ADMIN",
  "TRANSPORT_MANAGER",
  "LIBRARIAN",
  "STAFF",
]);

type DomainKind = "staff" | "student" | "guardian";
type DomainOption = { id: string; label: string; sub: string };

function domainEndpoint(kind: DomainKind, q: string): string {
  if (kind === "staff")
    return `/api/staff?search=${encodeURIComponent(q)}&pageSize=6`;
  if (kind === "student")
    return `/api/students?search=${encodeURIComponent(q)}&pageSize=6`;
  return `/api/guardians?search=${encodeURIComponent(q)}&pageSize=6`;
}

function SectionCard({
  icon: Icon,
  title,
  description,
  children,
}: {
  icon: typeof UserIcon;
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-sm rounded-lg border border-border bg-surface p-md">
      <div className="flex items-center gap-2">
        <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

/** Minimal live search over the real staff/student/guardian directories — no mock data, no client-maintained list. */
function DomainPicker({
  kind,
  value,
  onChange,
}: {
  kind: DomainKind;
  value: DomainOption | null;
  onChange: (v: DomainOption | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<DomainOption[]>([]);
  const [open, setOpen] = useState(false);

  async function search(q: string) {
    setQuery(q);
    if (q.trim().length < 2) {
      setOptions([]);
      return;
    }
    const res = await apiGet<Record<string, unknown>[]>(
      domainEndpoint(kind, q),
    );
    if (!res.success) return;
    setOptions(
      res.data.map((row) => {
        if (kind === "staff")
          return {
            id: String(row.id),
            label: String(row.name ?? ""),
            sub: String(row.employeeCode ?? ""),
          };
        if (kind === "student")
          return {
            id: String(row.id),
            label: String(row.fullName ?? ""),
            sub: String(row.admissionNumber ?? ""),
          };
        return {
          id: String(row.id),
          label: String(row.fullName ?? ""),
          sub: String(row.email ?? row.phone ?? ""),
        };
      }),
    );
  }

  if (value) {
    return (
      <div className="flex items-center justify-between gap-sm rounded-md border border-border bg-surface-secondary/60 px-sm py-1.5 text-sm">
        <span className="truncate">
          {value.label}{" "}
          {value.sub && (
            <span className="text-muted-foreground">· {value.sub}</span>
          )}
        </span>
        <Button size="sm" variant="ghost" onClick={() => onChange(null)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Input
        value={query}
        onChange={(e) => {
          search(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder={`Search ${kind}s by name…`}
      />
      {open && options.length > 0 && (
        <div className="absolute z-10 mt-1 w-full rounded-md border border-border bg-surface shadow-lg">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className="block w-full px-sm py-1.5 text-left text-sm hover:bg-muted"
              onClick={() => {
                onChange(o);
                setOpen(false);
              }}>
              {o.label}{" "}
              <span className="text-xs text-muted-foreground">{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function PhotoUpload({
  url,
  onChange,
}: {
  url: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-md">
      <Avatar className="size-16 shrink-0 border border-border">
        {url && <AvatarImage src={url} alt="" />}
        <AvatarFallback>
          <ImagePlus className="size-5 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <Label htmlFor="photo-url">Photo URL</Label>
        <div className="flex gap-xs">
          <Input
            id="photo-url"
            value={url}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
          />
          {url && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => onChange("")}
              aria-label="Remove photo">
              <X className="size-3.5" />
            </Button>
          )}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Paste a link to a hosted image. Direct file upload isn&apos;t
          available in this system yet.
        </p>
      </div>
    </div>
  );
}

export default function CreateAccountPage() {
  const router = useRouter();
  const { data: provisionableRoles, loading: rolesLoading } =
    useProvisionableRoles();
  const provision = useProvisionAccount();
  const { data: currentContext } = useApiResource<{
    school: { name: string } | null;
    branch: { id: string; name: string } | null;
  }>("/api/auth/context");
  const { data: branches } = useApiResource<{ id: string; name: string }[]>(
    "/api/auth/context/branches",
  );
  const { data: departments } = useDepartments({ status: "active" });

  const [targetRoleKey, setTargetRoleKey] = useState("");
  const [mode, setMode] = useState<"link" | "create">("link");
  const [domainValue, setDomainValue] = useState<DomainOption | null>(null);

  // Personal / school-assignment (create-new mode only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gender, setGender] =
    useState<NewStudentInput["gender"]>("prefer-not-to-say");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [mobile, setMobile] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [employeeCode, setEmployeeCode] = useState("");
  const [admissionNumber, setAdmissionNumber] = useState("");
  const [admissionDate, setAdmissionDate] = useState("");
  const [relation, setRelation] =
    useState<NewGuardianInput["relation"]>("guardian");
  const [linkToStudent, setLinkToStudent] = useState<DomainOption | null>(null);
  const [branchId, setBranchId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [joiningDate, setJoiningDate] = useState("");
  // Department is a real filter, not just a display grouping — a designation
  // belongs to at most one department (see resolveDeptDesigWrite server-side),
  // so once a department is chosen only its own designations are offered.
  const { data: designations } = useDesignations({
    status: "active",
    departmentId: departmentId || undefined,
  });

  function selectDepartment(v: string) {
    setDepartmentId(v);
    setDesignationId("");
  }

  // Login credentials
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [forcePasswordChange, setForcePasswordChange] = useState(false);
  const [status, setStatus] = useState<"active" | "inactive">("active");

  const [result, setResult] = useState<{
    accountCreated: boolean;
    domainRecordCreated: boolean;
  } | null>(null);

  const domainKind: DomainKind | null = targetRoleKey
    ? STAFF_LINKED_ROLES.has(targetRoleKey)
      ? "staff"
      : targetRoleKey === "STUDENT"
        ? "student"
        : targetRoleKey === "GUARDIAN"
          ? "guardian"
          : null
    : null;
  const strength = passwordStrength(password);
  const passwordsMismatch =
    confirmPassword.length > 0 && password !== confirmPassword;

  function selectRole(v: string) {
    setTargetRoleKey(v);
    setDomainValue(null);
    setMode("link");
  }

  function canSubmit(): boolean {
    if (!targetRoleKey || !domainKind || !email) return false;
    if (!strength.meetsPolicy || password !== confirmPassword) return false;
    if (mode === "link") return domainValue !== null;
    if (domainKind === "staff") return Boolean(firstName && employeeCode);
    if (domainKind === "student")
      return Boolean(firstName && lastName && dateOfBirth && admissionNumber);
    return Boolean(firstName && lastName && linkToStudent);
  }

  async function submit() {
    if (!targetRoleKey || !domainKind) return;
    const credentials = {
      password,
      confirmPassword,
      forcePasswordChange,
      status,
    };
    const idField =
      mode === "link"
        ? domainKind === "staff"
          ? { staffId: domainValue!.id }
          : domainKind === "student"
            ? { studentId: domainValue!.id }
            : { guardianId: domainValue!.id }
        : domainKind === "staff"
          ? {
              newStaff: {
                employeeCode,
                firstName,
                lastName: lastName || undefined,
                phone: mobile || undefined,
                departmentId: departmentId || undefined,
                designationId: designationId || undefined,
                joiningDate: joiningDate || undefined,
              } as NewStaffInput,
            }
          : domainKind === "student"
            ? {
                newStudent: {
                  admissionNumber,
                  firstName,
                  lastName,
                  dateOfBirth,
                  gender,
                  phone: mobile || undefined,
                  admissionDate: admissionDate || undefined,
                  branchId: branchId || undefined,
                } as NewStudentInput,
              }
            : {
                newGuardian: {
                  firstName,
                  lastName,
                  phone: mobile || undefined,
                  linkToStudentId: linkToStudent!.id,
                  relation,
                } as NewGuardianInput,
              };

    const res = await provision.run({
      targetRoleKey,
      email,
      ...idField,
      ...credentials,
    });
    if (res.success)
      setResult({
        accountCreated: res.data.accountCreated,
        domainRecordCreated: res.data.domainRecordCreated,
      });
  }

  if (!rolesLoading && provisionableRoles?.length === 0) {
    return (
      <div className="mx-auto flex max-w-lg flex-col items-center gap-sm py-3xl text-center">
        <p className="text-sm font-medium text-foreground">
          You are not authorized to create accounts
        </p>
        <p className="text-xs text-muted-foreground">
          Your role is not authorized to provision any account type.
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/users">
            <ArrowLeft className="size-3.5" /> Back to Users &amp; Access
          </Link>
        </Button>
      </div>
    );
  }

  if (result) {
    return (
      <div className="mx-auto flex  flex-col gap-md py-3xl text-center">
        <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-success/10 text-success">
          <ShieldCheck className="size-6" />
        </span>
        <div>
          <p className="text-base font-semibold text-foreground">
            Account created
          </p>
          <p className="text-sm text-muted-foreground">
            {result.domainRecordCreated
              ? "A new record and login were created."
              : "A login was linked to the existing record."}
            {forcePasswordChange &&
              " The new user will be asked to change their password on first login."}
          </p>
        </div>
        <div className="mx-auto flex gap-xs">
          <Button size="sm" onClick={() => router.push("/users")}>
            Back to Users &amp; Access
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.location.reload()}>
            Create another
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-md pb-24 sm:pb-0">
      <div>
        <Link
          href="/users"
          className="mb-sm inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3.5" /> Users &amp; Access
        </Link>
        <h1 className="flex items-center gap-2 text-lg font-semibold text-foreground">
          <UserPlus className="size-5 text-primary" /> Create account
        </h1>
        <p className="text-xs text-muted-foreground">
          Provision a login for a real Staff, Student, or Guardian record.
        </p>
      </div>

      <SectionCard
        icon={ShieldCheck}
        title="Role & Permissions"
        description="Only roles you are authorized to grant are listed.">
        <Select value={targetRoleKey} onValueChange={selectRole}>
          <SelectTrigger aria-label="Target role">
            <SelectValue placeholder="Choose a role" />
          </SelectTrigger>
          <SelectContent>
            {(provisionableRoles ?? []).map((r) => (
              <SelectItem key={r.key} value={r.key}>
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {domainKind && (
          <div className="flex flex-col gap-sm">
            <div className="inline-flex w-fit rounded-md border border-border p-0.5">
              <button
                type="button"
                onClick={() => setMode("link")}
                className={`rounded px-sm py-1 text-xs font-medium ${mode === "link" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                Link existing record
              </button>
              <button
                type="button"
                onClick={() => setMode("create")}
                className={`rounded px-sm py-1 text-xs font-medium ${mode === "create" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                Create new record
              </button>
            </div>
            {mode === "link" && (
              <div>
                <Label>
                  {domainKind === "staff"
                    ? "Staff record"
                    : domainKind === "student"
                      ? "Student"
                      : "Guardian"}
                </Label>
                <DomainPicker
                  kind={domainKind}
                  value={domainValue}
                  onChange={setDomainValue}
                />
              </div>
            )}
          </div>
        )}
      </SectionCard>

      {domainKind && mode === "create" && domainKind !== "staff" && (
        <SectionCard
          icon={ImagePlus}
          title="Profile Photo"
          description="Optional.">
          <PhotoUpload url={photoUrl} onChange={setPhotoUrl} />
        </SectionCard>
      )}

      {domainKind && mode === "create" && (
        <SectionCard icon={UserIcon} title="Personal Information">
          <div className="grid gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="pi-first">First name *</Label>
              <Input
                id="pi-first"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor="pi-last">
                Last name{domainKind === "staff" ? " (optional)" : " *"}
              </Label>
              <Input
                id="pi-last"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          {domainKind === "student" && (
            <div className="grid gap-sm sm:grid-cols-2">
              <div>
                <Label htmlFor="pi-dob">Date of birth *</Label>
                <Input
                  id="pi-dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div>
                <Label>Gender</Label>
                <Select
                  value={gender}
                  onValueChange={(v) =>
                    setGender(v as NewStudentInput["gender"])
                  }>
                  <SelectTrigger aria-label="Gender">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                    <SelectItem value="prefer-not-to-say">
                      Prefer not to say
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div className="grid gap-sm sm:grid-cols-2">
            <div>
              <Label htmlFor="pi-mobile">Mobile number</Label>
              <Input
                id="pi-mobile"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
              />
            </div>
            {domainKind === "staff" && (
              <div>
                <Label htmlFor="pi-code">Employee code *</Label>
                <Input
                  id="pi-code"
                  value={employeeCode}
                  onChange={(e) => setEmployeeCode(e.target.value)}
                />
              </div>
            )}
            {domainKind === "student" && (
              <div>
                <Label htmlFor="pi-adm">Admission number *</Label>
                <Input
                  id="pi-adm"
                  value={admissionNumber}
                  onChange={(e) => setAdmissionNumber(e.target.value)}
                />
              </div>
            )}
            {domainKind === "guardian" && (
              <div>
                <Label>Relation</Label>
                <Select
                  value={relation}
                  onValueChange={(v) =>
                    setRelation(v as NewGuardianInput["relation"])
                  }>
                  <SelectTrigger aria-label="Relation">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="father">Father</SelectItem>
                    <SelectItem value="mother">Mother</SelectItem>
                    <SelectItem value="guardian">Guardian</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          {domainKind === "guardian" && (
            <div>
              <Label>Link to student *</Label>
              <DomainPicker
                kind="student"
                value={linkToStudent}
                onChange={setLinkToStudent}
              />
            </div>
          )}
        </SectionCard>
      )}

      {domainKind && mode === "create" && domainKind !== "guardian" && (
        <SectionCard icon={Building2} title="School Assignment">
          <div className="grid gap-sm sm:grid-cols-2">
            <div>
              <Label>School</Label>
              <Input value={currentContext?.school?.name ?? ""} disabled />
            </div>
            {domainKind === "student" && (branches?.length ?? 0) > 1 ? (
              <div>
                <Label>Branch</Label>
                <Select value={branchId} onValueChange={setBranchId}>
                  <SelectTrigger aria-label="Branch">
                    <SelectValue placeholder="Select branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {(branches ?? []).map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div>
                <Label>Branch</Label>
                <Input value={currentContext?.branch?.name ?? ""} disabled />
              </div>
            )}
          </div>
          {domainKind === "student" && (
            <div>
              <Label htmlFor="sa-admdate">Admission date (optional)</Label>
              <Input
                id="sa-admdate"
                type="date"
                value={admissionDate}
                onChange={(e) => setAdmissionDate(e.target.value)}
              />
            </div>
          )}
          {domainKind === "staff" && (
            <>
              <div>
                <Label htmlFor="sa-joining">Joining date (optional)</Label>
                <Input
                  id="sa-joining"
                  type="date"
                  value={joiningDate}
                  onChange={(e) => setJoiningDate(e.target.value)}
                />
              </div>
              {((departments?.length ?? 0) > 0 ||
                (designations?.length ?? 0) > 0) && (
                <div className="grid gap-sm sm:grid-cols-2">
                  {(departments?.length ?? 0) > 0 && (
                    <div>
                      <Label>Department</Label>
                      <Select
                        value={departmentId}
                        onValueChange={selectDepartment}>
                        <SelectTrigger aria-label="Department">
                          <SelectValue placeholder="Select department" />
                        </SelectTrigger>
                        <SelectContent>
                          {departments.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {(designations?.length ?? 0) > 0 && (
                    <div>
                      <Label>Designation</Label>
                      <Select
                        value={designationId}
                        onValueChange={setDesignationId}>
                        <SelectTrigger aria-label="Designation">
                          <SelectValue placeholder="Select designation" />
                        </SelectTrigger>
                        <SelectContent>
                          {designations.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </SectionCard>
      )}

      {domainKind && (
        <>
          <SectionCard icon={KeyRound} title="Login Credentials">
            <div>
              <Label htmlFor="lc-email">Email / Username *</Label>
              <Input
                id="lc-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@example.com"
              />
            </div>
            <div className="grid gap-sm sm:grid-cols-2">
              <div>
                <Label htmlFor="lc-pass">Password *</Label>
                <PasswordInput
                  id="lc-pass"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <PasswordStrengthMeter value={password} />
              </div>
              <div>
                <Label htmlFor="lc-confirm">Confirm Password *</Label>
                <PasswordInput
                  id="lc-confirm"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                {passwordsMismatch && (
                  <p className="mt-1 text-xs text-destructive">
                    Passwords do not match.
                  </p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 text-xs text-foreground">
              <Checkbox
                checked={forcePasswordChange}
                onCheckedChange={(v) => setForcePasswordChange(v === true)}
              />
              Force password change on first login
            </label>
          </SectionCard>

          <SectionCard icon={ShieldCheck} title="Account Status">
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as "active" | "inactive")}>
              <SelectTrigger
                aria-label="Account status"
                className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </SectionCard>

          {provision.error && (
            <p className="text-sm text-destructive">{provision.error}</p>
          )}

          <div className="flex gap-xs">
            <Button
              disabled={!canSubmit() || provision.loading}
              onClick={submit}>
              {provision.loading ? "Creating…" : "Create account"}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/users">Cancel</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
