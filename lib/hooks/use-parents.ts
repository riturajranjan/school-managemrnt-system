"use client";

import { useMemo } from "react";
import { useSisStore } from "./use-store";
import type { Guardian, ParentAccount, Student, StudentGuardianLink } from "@/lib/types/students";

export type ParentDirectoryRow = {
  account: ParentAccount;
  guardian: Guardian;
  children: { student: Student; link: StudentGuardianLink }[];
};

export function useParentDirectory(): ParentDirectoryRow[] {
  const db = useSisStore();
  return useMemo(() => {
    return db.parentAccounts
      .map((account) => {
        const guardian = db.guardians.find((g) => g.id === account.guardianId);
        const links = db.studentGuardianLinks.filter((l) => l.guardianId === account.guardianId);
        const children = links
          .map((link) => {
            const student = db.students.find((s) => s.id === link.studentId);
            return student ? { student, link } : null;
          })
          .filter((c): c is NonNullable<typeof c> => c !== null);
        return guardian ? { account, guardian, children } : null;
      })
      .filter((row): row is ParentDirectoryRow => row !== null);
  }, [db.parentAccounts, db.guardians, db.studentGuardianLinks, db.students]);
}

export function useParentProfile(parentAccountId: string | undefined) {
  const directory = useParentDirectory();
  return useMemo(() => directory.find((row) => row.account.id === parentAccountId), [directory, parentAccountId]);
}
