// Employee Self Service (production migration, Phase B) — the logged-in
// staff member's OWN real data, identity-scoped (Staff.userId === caller),
// never a hardcoded demo identity. Pure aggregation over existing real
// resolvers — getStaffAttendanceHistory/getStaffAttendancePercent already
// enforce "own record or broad manager" (lib/server/staff-attendance/
// service.ts), and listLeaveRequests already narrows to the caller's own
// staffId when they aren't a broad leave manager (lib/server/leave/
// service.ts) — no new authorization logic is invented here.
//
// Contract/document sections (Sub-batch 2) reuse the same real own-record
// scoping — see listContractsForStaff/listStaffDocumentsForStaff, which
// always redact compensationNote and only ever return staff-visible
// documents, regardless of the caller's role. Training/announcement sections
// are added as their real models land in later Phase B sub-batches.
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { HrSelfServiceDto } from "@/lib/api/contracts";
import { getCurrentStaffProfile, getStaff } from "@/lib/server/staff/service";
import { getStaffAttendanceHistory, getStaffAttendancePercent } from "@/lib/server/staff-attendance/service";
import { listLeaveRequests } from "@/lib/server/leave/service";
import { serverToday } from "@/lib/server/attendance/service";
import { listContractsForStaff } from "@/lib/server/hr/contracts";
import { listStaffDocumentsForStaff } from "@/lib/server/hr/documents";

function startOfMonth(today: string): string {
  return `${today.slice(0, 7)}-01`;
}

export async function getMySelfService(scope: OrgScope): Promise<HrSelfServiceDto> {
  const me = await getCurrentStaffProfile(scope);
  if (!me) throw new HttpError("NOT_FOUND", "No staff profile is linked to your account");

  const today = serverToday();
  const [staff, todayHistory, percent, leaveRequests, contracts, documents] = await Promise.all([
    getStaff(scope, me.id),
    getStaffAttendanceHistory(scope, me.id, { from: today, to: today }),
    getStaffAttendancePercent(scope, me.id, { from: startOfMonth(today), to: today }),
    listLeaveRequests(scope, {}),
    listContractsForStaff(scope, me.id),
    listStaffDocumentsForStaff(scope, me.id),
  ]);

  return {
    staff,
    todayAttendance: todayHistory[0] ?? null,
    attendancePercent: percent,
    recentLeaveRequests: leaveRequests.slice(0, 5),
    contracts,
    documents,
  };
}
