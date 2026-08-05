import { setState, type Db } from "@/lib/data/store";
import type { ParentAccount, StudentGuardianLink } from "@/lib/types/students";

function nowIso() {
  return new Date().toISOString();
}

function mapParentAccount(db: Db, id: string, fn: (account: ParentAccount) => ParentAccount): Db {
  return { ...db, parentAccounts: db.parentAccounts.map((a) => (a.id === id ? fn(a) : a)) };
}

export function sendPortalInvite(parentAccountId: string) {
  setState((db) => mapParentAccount(db, parentAccountId, (account) => ({ ...account, portalStatus: "invited", invitedAt: nowIso() })));
}

export function resetPortalAccess(parentAccountId: string) {
  setState((db) =>
    mapParentAccount(db, parentAccountId, (account) => ({ ...account, portalStatus: "active", loginHistory: [], lastLoginAt: undefined })),
  );
}

export function suspendPortalAccess(parentAccountId: string) {
  setState((db) => mapParentAccount(db, parentAccountId, (account) => ({ ...account, portalStatus: "suspended" })));
}

export function updatePickupAuthorization(studentId: string, guardianId: string, authorized: boolean) {
  setState((db) => ({
    ...db,
    studentGuardianLinks: db.studentGuardianLinks.map((link: StudentGuardianLink) =>
      link.studentId === studentId && link.guardianId === guardianId ? { ...link, isAuthorizedPickup: authorized } : link,
    ),
  }));
}

export function setPrimaryGuardian(studentId: string, guardianId: string) {
  setState((db) => ({
    ...db,
    studentGuardianLinks: db.studentGuardianLinks.map((link: StudentGuardianLink) =>
      link.studentId === studentId ? { ...link, isPrimary: link.guardianId === guardianId } : link,
    ),
    students: db.students.map((s) => (s.id === studentId ? { ...s, primaryGuardianId: guardianId, updatedAt: nowIso() } : s)),
  }));
}

export function linkGuardianToStudent(studentId: string, guardianId: string, relationship: StudentGuardianLink["relationship"]) {
  setState((db) => ({
    ...db,
    studentGuardianLinks: [
      ...db.studentGuardianLinks,
      { studentId, guardianId, relationship, isPrimary: false, isEmergencyContact: false, isAuthorizedPickup: false, isFeeResponsible: false },
    ],
    students: db.students.map((s) => (s.id === studentId ? { ...s, guardianIds: Array.from(new Set([...s.guardianIds, guardianId])) } : s)),
  }));
}
