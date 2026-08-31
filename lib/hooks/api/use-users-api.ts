"use client";

// Real client hooks for hierarchical account provisioning (Phase 9W.2,
// finalized in the User Account Creation Foundation review) — GET
// /api/users*, POST /api/users/provision, PATCH .../status, POST .../roles,
// POST .../reset-password. No mock store, no client-maintained role policy:
// the provisionable-roles list and every authorization decision come from
// the server.
import { apiPatch, apiPost } from "@/lib/api/client";
import { buildQuery, useApiList, useApiMutation, useApiResource } from "./use-api";

export type ProvisionableRole = { key: string; name: string };

export type AccountListItem = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  mobile: string | null;
  status: string;
  passwordSetupRequired: boolean;
  roles: { key: string; name: string }[];
  staffId: string | null;
  studentId: string | null;
  guardianId: string | null;
  code: string | null;
  branchId: string | null;
  branchName: string | null;
  designation: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string | null; roleKey: string | null; roleName: string | null } | null;
};

export type AccountDetail = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  status: string;
  emailVerifiedAt: string | null;
  passwordSetupRequired: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
  roles: { key: string; name: string }[];
  domainKind: "staff" | "student" | "guardian" | null;
  staffId: string | null;
  studentId: string | null;
  guardianId: string | null;
  personal: {
    firstName: string | null;
    lastName: string | null;
    gender: string | null;
    dateOfBirth: string | null;
    mobile: string | null;
    contactEmail: string | null;
    photoUrl: string | null;
  };
  schoolAssignment: {
    schoolName: string | null;
    branchId: string | null;
    branchName: string | null;
    designation: string | null;
    department: string | null;
    joiningDate: string | null;
  } | null;
  access: {
    schoolId: string | null;
    branchId: string | null;
    rolePermissions: { roleKey: string; roleName: string; permissions: string[] }[];
    effectivePermissions: string[];
  };
};

export type EditAccountInput = Partial<{
  firstName: string;
  lastName: string;
  gender: "male" | "female" | "other" | "prefer-not-to-say";
  dateOfBirth: string;
  phone: string;
  email: string;
  photoUrl: string;
  departmentId: string;
  designationId: string;
  joiningDate: string;
}>;

export type AccountActivityEntry = {
  id: string;
  action: string;
  entityType: string;
  createdAt: string;
  actorName: string | null;
  meta: Record<string, unknown> | null;
};

/** Fields for creating a brand-new Staff profile inline (reuses the real
 * createStaff service — see lib/server/staff/service.ts createStaffSchema). */
export type NewStaffInput = {
  employeeCode: string;
  firstName: string;
  lastName?: string;
  email?: string;
  phone?: string;
  designation?: string;
  department?: string;
  departmentId?: string;
  designationId?: string;
  employmentType?: "full-time" | "part-time" | "contract" | "temporary";
  isTeaching?: boolean;
  joiningDate?: string;
};

/** Fields for creating a brand-new Student profile inline (subset of the
 * real createStudent service's schema — see lib/server/students/service.ts). */
export type NewStudentInput = {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender?: "male" | "female" | "other" | "prefer-not-to-say";
  email?: string;
  phone?: string;
  classLabel?: string;
  sectionLabel?: string;
  admissionDate?: string;
  branchId?: string;
  academicSessionId?: string;
};

/** Fields for creating a brand-new Guardian profile inline, linked to an
 * EXISTING student (a Guardian is never created unlinked). */
export type NewGuardianInput = {
  firstName: string;
  lastName: string;
  email?: string;
  phone?: string;
  linkToStudentId: string;
  relation?: "father" | "mother" | "guardian";
};

export type ProvisionAccountInput = {
  targetRoleKey: string;
  email: string;
  name?: string;
  // Link an existing, unlinked domain record…
  staffId?: string;
  studentId?: string;
  guardianId?: string;
  // …OR create one inline.
  newStaff?: NewStaffInput;
  newStudent?: NewStudentInput;
  newGuardian?: NewGuardianInput;
  // Optional direct credentials — set a real password now instead of the
  // invite-link flow. Omit entirely to keep the invite-link behavior.
  password?: string;
  confirmPassword?: string;
  forcePasswordChange?: boolean;
  status?: "active" | "inactive";
};

export type ProvisionAccountResult = {
  userId: string;
  targetRoleKey: string;
  accountCreated: boolean;
  accountLinked: boolean;
  domainRecordCreated: boolean;
  passwordSetDirectly: boolean;
  passwordSetupPending: boolean;
  passwordSetupUrl: string | null;
};

export function useProvisionableRoles() {
  return useApiResource<ProvisionableRole[]>("/api/users/provisionable-roles");
}

/** Every real system role — for the User List's Role filter. Not policy-gated
 * (unlike useProvisionableRoles, which is scoped to what the actor may
 * create) — see GET /api/users/roles. */
export function useAllRoleOptions() {
  return useApiResource<ProvisionableRole[]>("/api/users/roles");
}

export function useAccounts(
  params: { search?: string; role?: string; status?: string; branchId?: string; page?: number; pageSize?: number } = {},
) {
  return useApiList<AccountListItem>(`/api/users${buildQuery(params)}`);
}

export function useAccountDetail(userId: string | null) {
  return useApiResource<AccountDetail>(userId ? `/api/users/${userId}` : null);
}

export function useUpdateAccount() {
  return useApiMutation((userId: string, input: EditAccountInput) => apiPatch<AccountDetail>(`/api/users/${userId}`, input));
}

export function useAccountActivity(userId: string | null) {
  return useApiResource<AccountActivityEntry[]>(userId ? `/api/users/${userId}/activity` : null);
}

export function useProvisionAccount() {
  return useApiMutation((input: ProvisionAccountInput) => apiPost<ProvisionAccountResult>("/api/users/provision", input));
}

export function useSetAccountStatus() {
  return useApiMutation((userId: string, status: "ACTIVE" | "SUSPENDED") => apiPatch<{ success: true }>(`/api/users/${userId}/status`, { status }));
}

export function useAssignRole() {
  return useApiMutation((userId: string, targetRoleKey: string) => apiPost<{ success: true }>(`/api/users/${userId}/roles`, { targetRoleKey }));
}

/** Still-real invite/setup-link reissue — kept for accounts that never
 * completed their initial invite. Not wired to the User List/Profile
 * password actions anymore (those use real direct password changes below);
 * this stays available as its own capability. */
export function useResetPassword() {
  return useApiMutation((userId: string) => apiPost<{ passwordSetupUrl: string }>(`/api/users/${userId}/reset-password`, {}));
}

/** Self-service password change — always requires the caller's real current
 * password. Works pre-org-context too (the forced first-login flow). */
export function useChangeOwnPassword() {
  return useApiMutation((input: { currentPassword: string; newPassword: string }) =>
    apiPost<{ redirectTo: string }>("/api/auth/change-password", input),
  );
}

/** Administrator password reset — sets a real password directly, no link.
 * Never usable on the actor's own account (server-enforced). */
export function useAdminSetPassword() {
  return useApiMutation((userId: string, input: { newPassword: string; forcePasswordChange?: boolean }) =>
    apiPost<{ success: true }>(`/api/users/${userId}/password`, input),
  );
}
