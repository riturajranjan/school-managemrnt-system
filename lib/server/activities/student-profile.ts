// Student 360 Activities tab (Phase 9U) — real memberships/events/
// participation/achievements only. No fake points, rank, or achievement score.
import { prisma } from "@/lib/db/prisma";
import { HttpError } from "@/lib/server/api/guard";
import type { OrgScope } from "@/lib/server/api/scope";
import type { StudentActivityProfileDto } from "@/lib/api/contracts";
import { listMemberships } from "./memberships";
import { listAchievements } from "./achievements";
import { studentDisplayName } from "./access";

export async function getStudentActivityProfile(scope: OrgScope, studentId: string): Promise<StudentActivityProfileDto> {
  const student = await prisma.student.findFirst({ where: { id: studentId, schoolId: scope.schoolId }, select: { id: true } });
  if (!student) throw new HttpError("NOT_FOUND", "Student not found");

  const [allMemberships, achievements] = await Promise.all([
    listMemberships(scope, { studentId }),
    listAchievements(scope, { studentId }),
  ]);
  const activeMemberships = allMemberships.filter((m) => m.status === "active");
  const pastMemberships = allMemberships.filter((m) => m.status === "ended");
  const activityIds = activeMemberships.map((m) => m.activityId);

  const [upcomingEvents, recentParticipation] = await Promise.all([
    activityIds.length
      ? prisma.activityEvent.findMany({
          where: { schoolId: scope.schoolId, activityId: { in: activityIds }, status: "PUBLISHED", startAt: { gte: new Date() } },
          select: { id: true, activityId: true, title: true, description: true, startAt: true, endAt: true, location: true, status: true, createdAt: true, updatedAt: true, activity: { select: { name: true } }, _count: { select: { participants: true } } },
          orderBy: { startAt: "asc" },
          take: 10,
        })
      : Promise.resolve([]),
    prisma.activityEventParticipant.findMany({
      where: { schoolId: scope.schoolId, studentId },
      select: { id: true, eventId: true, studentId: true, status: true, registeredAt: true, attendedAt: true, student: { select: { firstName: true, lastName: true, admissionNumber: true } } },
      orderBy: { registeredAt: "desc" },
      take: 10,
    }),
  ]);

  return {
    activeMemberships, pastMemberships,
    upcomingEvents: upcomingEvents.map((e) => ({
      id: e.id, activityId: e.activityId, activityName: e.activity.name, title: e.title, description: e.description,
      startAt: e.startAt.toISOString(), endAt: e.endAt?.toISOString() ?? null, location: e.location,
      status: e.status.toLowerCase() as "draft" | "published" | "completed" | "cancelled", participantCount: e._count.participants,
      createdAt: e.createdAt.toISOString(), updatedAt: e.updatedAt.toISOString(),
    })),
    recentParticipation: recentParticipation.map((p) => ({
      id: p.id, eventId: p.eventId, studentId: p.studentId, studentName: studentDisplayName(p.student), admissionNumber: p.student.admissionNumber,
      status: p.status.toLowerCase() as "registered" | "attended" | "absent" | "cancelled", registeredAt: p.registeredAt.toISOString(), attendedAt: p.attendedAt?.toISOString() ?? null,
    })),
    achievements,
  };
}
