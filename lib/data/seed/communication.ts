import type { Student } from "@/lib/types/students";
import type { Teacher } from "@/lib/types/academics";
import type {
  Announcement,
  Broadcast,
  CommNotification,
  CommunicationGroup,
  CommunicationTemplate,
  Conversation,
  ConversationParticipant,
  Delivery,
  FrontDeskIncident,
  GatePass,
  HelpdeskTicket,
  KnowledgeArticle,
  Message,
  Notice,
  NotificationSettings,
  ReceptionCall,
  ScheduledCommunication,
  TicketReply,
  Visitor,
  VisitorAppointment,
} from "@/lib/types/communication";
import { CURRENT_TEACHER_NAME } from "@/lib/current-user";
import { firstNamesFemale, firstNamesMale, lastNames } from "./names";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(11082026);
const TODAY = "2026-08-05";
const AVATAR_COLORS = ["#022c43", "#18b0c8", "#0f766e", "#7c3aed", "#b45309", "#be123c", "#1d4ed8", "#047857"];

export const ME_ID = "me";

function time(hoursAgo: number): string {
  const d = new Date("2026-08-05T14:00:00Z");
  d.setHours(d.getHours() - hoursAgo);
  return d.toISOString();
}

export function buildCommunicationData(students: Student[], teachers: Teacher[]) {
  const me: ConversationParticipant = { id: ME_ID, name: CURRENT_TEACHER_NAME, role: "teacher", avatarColor: "#18b0c8" };

  // Build a pool of parent participants tied to real students.
  const contextStudents = students.slice(0, 24);
  const participants: ConversationParticipant[] = [me];
  const conversations: Conversation[] = [];
  const messages: Message[] = [];

  const categories = ["academic", "attendance", "homework", "behavior", "exam", "transport", "fee-query", "general", "meeting-request"] as const;
  const parentReplies = [
    "Thank you for letting me know.",
    "I'll speak with them tonight.",
    "Could we schedule a quick call?",
    "Understood, we'll ensure the homework is done.",
    "Is everything alright with the bus timing?",
    "Appreciate the update, thank you.",
    "When is the parent meeting?",
    "We've made the fee payment today.",
  ];
  const teacherReplies = [
    "Sharing an update on today's class.",
    "Aarav did really well in the assessment.",
    "Please ensure the pending homework is submitted.",
    "Attendance was marked present today.",
    "The exam schedule has been shared on the notice board.",
    "Happy to meet this week — does Thursday work?",
    "Noted, thank you for the quick response.",
  ];

  contextStudents.forEach((student, i) => {
    const female = helpers.bool();
    const parentName = `${helpers.pick(female ? firstNamesFemale : firstNamesMale)} ${student.profile.lastName}`;
    const parent: ConversationParticipant = { id: `part-parent-${i}`, name: parentName, role: "parent", avatarColor: helpers.pick(AVATAR_COLORS) };
    participants.push(parent);

    const category = helpers.pick(categories);
    const priority = helpers.rand() < 0.12 ? "urgent" : helpers.rand() < 0.28 ? "priority" : "normal";
    const status = helpers.rand() < 0.65 ? "open" : helpers.rand() < 0.9 ? "resolved" : "archived";
    const unread = status === "open" && helpers.bool(0.5) ? helpers.int(1, 3) : 0;
    const convId = `conv-${i + 1}`;
    const lastAt = time(helpers.int(0, 72));

    // 3–6 messages per conversation, alternating.
    const count = helpers.int(3, 6);
    let lastPreview = "";
    let hasAttachment = false;
    for (let m = 0; m < count; m++) {
      const fromMe = m % 2 === 1;
      const body = fromMe ? helpers.pick(teacherReplies) : helpers.pick(parentReplies);
      const withAttachment = !fromMe && helpers.bool(0.15);
      if (withAttachment) hasAttachment = true;
      lastPreview = body;
      messages.push({
        id: `msg-${convId}-${m}`,
        conversationId: convId,
        senderId: fromMe ? ME_ID : parent.id,
        fromMe,
        body,
        attachments: withAttachment ? [{ id: `att-${convId}-${m}`, name: "report.pdf", kind: "pdf" }] : [],
        internal: false,
        delivery: fromMe ? (helpers.rand() < 0.08 ? "failed" : m === count - 1 ? "delivered" : "read") : "read",
        sentAt: time(helpers.int(0, 72) + (count - m) * 2),
      });
    }
    // Occasional private internal note.
    if (helpers.bool(0.25)) {
      messages.push({ id: `msg-${convId}-note`, conversationId: convId, senderId: ME_ID, fromMe: true, body: "Internal: flagged for follow-up with class teacher.", attachments: [], internal: true, delivery: "sent", sentAt: lastAt });
    }

    conversations.push({
      id: convId,
      subject: `${category === "fee-query" ? "Fee query" : category.charAt(0).toUpperCase() + category.slice(1)} — ${student.profile.firstName}`,
      category,
      participantIds: [ME_ID, parent.id],
      counterpartId: parent.id,
      studentId: student.id,
      priority,
      status,
      unreadCount: unread,
      hasAttachment,
      lastMessagePreview: lastPreview,
      lastMessageAt: lastAt,
      nextFollowUpAt: helpers.bool(0.3) ? helpers.daysFromNowIso(helpers.int(1, 7)).slice(0, 10) : undefined,
      createdAt: time(helpers.int(72, 240)),
    });
  });

  // A few staff/teacher conversations.
  teachers.slice(0, 4).forEach((t, i) => {
    const other: ConversationParticipant = { id: `part-staff-${i}`, name: t.name, role: "teacher", avatarColor: helpers.pick(AVATAR_COLORS) };
    participants.push(other);
    const convId = `conv-staff-${i + 1}`;
    messages.push({ id: `msg-${convId}-0`, conversationId: convId, senderId: other.id, fromMe: false, body: "Can you cover my period 3 tomorrow?", attachments: [], internal: false, delivery: "read", sentAt: time(6) });
    messages.push({ id: `msg-${convId}-1`, conversationId: convId, senderId: ME_ID, fromMe: true, body: "Sure, I'll take it.", attachments: [], internal: false, delivery: "delivered", sentAt: time(5) });
    conversations.push({ id: convId, subject: `Cover request`, category: "general", participantIds: [ME_ID, other.id], counterpartId: other.id, priority: "normal", status: "open", unreadCount: i === 0 ? 1 : 0, hasAttachment: false, lastMessagePreview: "Sure, I'll take it.", lastMessageAt: time(5), createdAt: time(24) });
  });

  // ---- Groups ----
  const groups: CommunicationGroup[] = [
    { id: "grp-1", name: "Grade 7-A Parents", type: "parents", memberCount: 32, adminIds: [ME_ID], lastMessagePreview: "Reminder: PTM this Saturday.", lastMessageAt: time(3), pinned: true, muted: false, archived: false, createdAt: TODAY },
    { id: "grp-2", name: "Mathematics Teachers", type: "teachers", memberCount: 8, adminIds: [ME_ID], lastMessagePreview: "Question bank shared.", lastMessageAt: time(20), pinned: false, muted: false, archived: false, createdAt: TODAY },
    { id: "grp-3", name: "Route 4 — Whitefield", type: "transport-route", memberCount: 28, adminIds: [], lastMessagePreview: "Bus running 10 min late today.", lastMessageAt: time(8), pinned: false, muted: true, archived: false, createdAt: TODAY },
    { id: "grp-4", name: "Sports Day Committee", type: "event", memberCount: 14, adminIds: [ME_ID], lastMessagePreview: "Practice at 4 PM.", lastMessageAt: time(30), pinned: false, muted: false, archived: false, createdAt: TODAY },
    { id: "grp-5", name: "Science Club", type: "club", memberCount: 22, adminIds: [], lastMessagePreview: "Project submissions due Friday.", lastMessageAt: time(50), pinned: false, muted: false, archived: false, createdAt: TODAY },
    { id: "grp-6", name: "All Staff", type: "staff", memberCount: 64, adminIds: [], lastMessagePreview: "Safeguarding training next week.", lastMessageAt: time(40), pinned: false, muted: false, archived: false, createdAt: TODAY },
  ];

  // ---- Announcements ----
  const announcements: Announcement[] = [
    { id: "ann-1", title: "Independence Day Holiday", body: "The school will remain closed on 15 August for Independence Day. Regular classes resume on 16 August.", category: "holiday", audience: "everyone", priority: "normal", channels: ["in-app", "push", "sms"], status: "scheduled", acknowledgementRequired: false, hasAttachment: false, publishAt: helpers.daysFromNowIso(6), sentCount: 0, seenCount: 0, acknowledgedCount: 0, createdBy: "Principal", createdAt: time(20) },
    { id: "ann-2", title: "Term 1 Examination Schedule", body: "The Term 1 examination schedule for Grades 6–10 has been published. Please review the timetable on the notice board.", category: "exam-schedule", audience: "parents", priority: "important", channels: ["in-app", "email"], status: "published", acknowledgementRequired: true, hasAttachment: true, publishAt: time(48), sentCount: 1248, seenCount: 1081, acknowledgedCount: 924, createdBy: "Examination Controller", createdAt: time(60) },
    { id: "ann-3", title: "Parent–Teacher Meeting", body: "PTM for all classes is scheduled this Saturday from 9 AM to 1 PM. Slots can be booked via the parent app.", category: "parent-meeting", audience: "parents", priority: "important", channels: ["in-app", "push", "whatsapp"], status: "published", acknowledgementRequired: true, hasAttachment: false, publishAt: time(24), sentCount: 1248, seenCount: 1120, acknowledgedCount: 1002, createdBy: "Administration", createdAt: time(30) },
    { id: "ann-4", title: "Fee Reminder — Term 1", body: "This is a gentle reminder that Term 1 fees are due by 10 August. Kindly clear pending dues to avoid a late fee.", category: "fee-reminder", audience: "parents", priority: "normal", channels: ["in-app", "sms"], status: "published", acknowledgementRequired: false, hasAttachment: false, publishAt: time(72), sentCount: 420, seenCount: 388, acknowledgedCount: 0, createdBy: "Accounts", createdAt: time(80) },
    { id: "ann-5", title: "Annual Sports Day", body: "Our Annual Sports Day will be held on 28 August. Parents are cordially invited to attend.", category: "school-event", audience: "everyone", priority: "normal", channels: ["in-app", "push"], status: "draft", acknowledgementRequired: false, hasAttachment: false, publishAt: helpers.daysFromNowIso(10), sentCount: 0, seenCount: 0, acknowledgedCount: 0, createdBy: "Sports Dept", createdAt: time(5) },
  ];

  // ---- Notices ----
  const notices: Notice[] = [
    { id: "not-1", title: "Library Book Return Drive", body: "All overdue library books must be returned by 12 August.", category: "academic", colorTone: "info", status: "published", acknowledgementRequired: false, publishAt: time(30), sentCount: 1248, seenCount: 900, acknowledgedCount: 0, createdAt: time(40) },
    { id: "not-2", title: "Revised Bus Timings — Route 4", body: "Route 4 morning pickup will start 10 minutes earlier from Monday.", category: "transport", colorTone: "warning", status: "published", acknowledgementRequired: true, publishAt: time(12), sentCount: 28, seenCount: 24, acknowledgedCount: 18, createdAt: time(20) },
    { id: "not-3", title: "Inter-House Cultural Fest", body: "Auditions for the cultural fest begin next week.", category: "cultural", colorTone: "success", status: "published", acknowledgementRequired: false, publishAt: time(48), sentCount: 620, seenCount: 500, acknowledgedCount: 0, createdAt: time(60) },
    { id: "not-4", title: "Half-Yearly Exam Instructions", body: "Detailed instructions for the half-yearly examinations.", category: "examination", colorTone: "warning", status: "scheduled", acknowledgementRequired: true, publishAt: helpers.daysFromNowIso(3), sentCount: 0, seenCount: 0, acknowledgedCount: 0, createdAt: time(10) },
    { id: "not-5", title: "Monsoon Safety Advisory", body: "Please ensure children carry raincoats. Buses may be delayed during heavy rain.", category: "general", colorTone: "info", status: "published", acknowledgementRequired: false, publishAt: time(6), expiresAt: helpers.daysFromNowIso(14), sentCount: 1248, seenCount: 700, acknowledgedCount: 0, createdAt: time(8) },
  ];

  // ---- Broadcasts ----
  const broadcasts: Broadcast[] = [
    { id: "bc-1", title: "Fee Due Reminder", message: "Dear parent, Term 1 fees are due by 10 August.", audience: "parents", channels: ["in-app", "sms"], status: "sent", estimatedRecipients: 420, deliveredCount: 402, failedCount: 18, sentAt: time(70), createdBy: "Accounts", createdAt: time(72) },
    { id: "bc-2", title: "PTM Slot Booking Open", message: "Book your parent-teacher meeting slot on the app.", audience: "parents", channels: ["in-app", "push"], status: "sent", estimatedRecipients: 1248, deliveredCount: 1240, failedCount: 8, sentAt: time(26), createdBy: "Administration", createdAt: time(28) },
    { id: "bc-3", title: "Sports Day Invite", message: "You are invited to Annual Sports Day on 28 August.", audience: "everyone", channels: ["in-app", "push", "email"], status: "scheduled", estimatedRecipients: 2100, deliveredCount: 0, failedCount: 0, scheduledAt: helpers.daysFromNowIso(9), createdBy: "Sports Dept", createdAt: time(4) },
  ];

  // ---- Scheduled communications (calendar) ----
  const scheduled: ScheduledCommunication[] = [
    { id: "sch-1", kind: "announcement", title: "Independence Day Holiday", date: helpers.daysFromNowIso(6).slice(0, 10) },
    { id: "sch-2", kind: "broadcast", title: "Sports Day Invite", date: helpers.daysFromNowIso(9).slice(0, 10) },
    { id: "sch-3", kind: "meeting", title: "Parent–Teacher Meeting", date: helpers.daysFromNowIso(3).slice(0, 10), time: "09:00" },
    { id: "sch-4", kind: "follow-up", title: "Follow up: Aarav homework", date: helpers.daysFromNowIso(2).slice(0, 10) },
    { id: "sch-5", kind: "reminder", title: "Fee due reminder", date: helpers.daysFromNowIso(5).slice(0, 10) },
    { id: "sch-6", kind: "event", title: "Cultural fest auditions", date: helpers.daysFromNowIso(7).slice(0, 10) },
    { id: "sch-7", kind: "announcement", title: "Half-yearly exam instructions", date: helpers.daysFromNowIso(3).slice(0, 10) },
  ];

  // ---- Templates ----
  const templates: CommunicationTemplate[] = [
    { id: "tpl-1", name: "Absence Alert", category: "attendance", subject: "Attendance notice", bodyEn: "Dear {{parent_name}}, {{student_name}} of {{class}} was marked absent today. Please confirm.", bodyHi: "प्रिय {{parent_name}}, {{class}} के {{student_name}} आज अनुपस्थित रहे। कृपया पुष्टि करें।", variables: ["parent_name", "student_name", "class"], channels: ["in-app", "sms", "whatsapp"], createdAt: TODAY },
    { id: "tpl-2", name: "Fee Due Reminder", category: "fees", subject: "Fee reminder", bodyEn: "Dear {{parent_name}}, an amount of {{amount_due}} for {{student_name}} is due by {{due_date}}.", bodyHi: "प्रिय {{parent_name}}, {{student_name}} के लिए {{amount_due}} की राशि {{due_date}} तक देय है।", variables: ["parent_name", "student_name", "amount_due", "due_date"], channels: ["in-app", "sms", "email"], createdAt: TODAY },
    { id: "tpl-3", name: "Exam Schedule", category: "exams", subject: "Upcoming exam", bodyEn: "{{exam_name}} for {{class}} is scheduled. Please check the timetable.", bodyHi: "{{class}} के लिए {{exam_name}} निर्धारित है। कृपया समय सारणी देखें।", variables: ["exam_name", "class"], channels: ["in-app", "push"], createdAt: TODAY },
    { id: "tpl-4", name: "Transport Delay", category: "transport", subject: "Bus delay", bodyEn: "{{route_name}} is running late today. Expected delay 10–15 minutes.", bodyHi: "{{route_name}} आज देरी से चल रही है। अनुमानित देरी 10–15 मिनट।", variables: ["route_name"], channels: ["in-app", "sms", "whatsapp"], createdAt: TODAY },
    { id: "tpl-5", name: "Birthday Wish", category: "birthday", subject: "Happy birthday", bodyEn: "Wishing {{student_name}} a very happy birthday from all of us at school!", bodyHi: "{{student_name}} को स्कूल की ओर से जन्मदिन की हार्दिक शुभकामनाएं!", variables: ["student_name"], channels: ["in-app", "whatsapp"], createdAt: TODAY },
    { id: "tpl-6", name: "Homework Reminder", category: "homework", subject: "Pending homework", bodyEn: "{{student_name}} has pending homework in {{class}}. Kindly ensure completion.", bodyHi: "{{class}} में {{student_name}} का होमवर्क लंबित है। कृपया पूरा करवाएं।", variables: ["student_name", "class"], channels: ["in-app"], createdAt: TODAY },
  ];

  // ---- Notifications ----
  const notifications: CommNotification[] = [
    { id: "cn-1", module: "communication", title: "New message from parent", description: "Priya Sharma replied about homework.", priority: "normal", read: false, archived: false, ctaLabel: "Open", ctaHref: "/communication/inbox", createdAt: time(1) },
    { id: "cn-2", module: "fees", title: "Fee payment received", description: "Term 1 fee for Aarav Sharma paid.", priority: "normal", read: false, archived: false, ctaLabel: "View", ctaHref: "/fees", createdAt: time(2) },
    { id: "cn-3", module: "attendance", title: "Attendance not marked", description: "Class 8B homeroom for today.", priority: "high", read: false, archived: false, ctaLabel: "Mark", ctaHref: "/attendance", createdAt: time(3) },
    { id: "cn-4", module: "exams", title: "Result published", description: "Term 1 results are now live.", priority: "normal", read: true, archived: false, ctaLabel: "View", ctaHref: "/results", createdAt: time(20) },
    { id: "cn-5", module: "transport", title: "Bus delay — Route 4", description: "Running 10 minutes late.", priority: "high", read: false, archived: false, ctaLabel: "Track", ctaHref: "/transport/live", createdAt: time(4) },
    { id: "cn-6", module: "library", title: "Book due soon", description: "3 books due within 2 days.", priority: "normal", read: true, archived: false, ctaHref: "/library/loans", createdAt: time(30) },
    { id: "cn-7", module: "hr", title: "Leave approved", description: "Your casual leave was approved.", priority: "normal", read: false, archived: false, ctaHref: "/hr/leave", createdAt: time(6) },
    { id: "cn-8", module: "system", title: "Scheduled maintenance", description: "Portal maintenance this Sunday 2–4 AM.", priority: "normal", read: true, archived: false, createdAt: time(48) },
    { id: "cn-9", module: "communication", title: "Announcement acknowledgement", description: "324 parents pending on exam schedule.", priority: "high", read: false, archived: false, ctaLabel: "Remind", ctaHref: "/communication/notices", createdAt: time(5) },
  ];

  const modules = ["academic", "attendance", "exams", "fees", "transport", "library", "hr", "communication", "system"] as const;
  const notificationSettings: NotificationSettings = {
    preferences: modules.map((m) => ({ module: m, channels: { "in-app": true, push: m !== "system", sms: m === "fees" || m === "attendance", whatsapp: m === "transport" || m === "fees", email: m === "exams" || m === "communication" } })),
    quietHoursStart: "21:00",
    quietHoursEnd: "07:00",
    language: "en",
    digest: "daily",
    emergencyOverride: true,
  };

  // ---- Helpdesk ----
  const ticketSubjects = [
    { s: "Unable to view Term 1 report card", c: "academic" as const, t: "Academics" },
    { s: "Fee receipt not generated", c: "fees" as const, t: "Accounts" },
    { s: "Bus not arrived at stop", c: "transport" as const, t: "Transport" },
    { s: "Smart board not working in Room 105", c: "it" as const, t: "IT Support" },
    { s: "Library card lost", c: "library" as const, t: "Library" },
    { s: "Leaking tap in washroom", c: "facilities" as const, t: "Facilities" },
    { s: "Payslip query", c: "hr" as const, t: "HR" },
    { s: "Change of address request", c: "administration" as const, t: "Administration" },
    { s: "Parent app login issue", c: "parent-support" as const, t: "Parent Support" },
    { s: "Student ID card reprint", c: "student-support" as const, t: "Student Support" },
    { s: "Wrong marks in mark sheet", c: "academic" as const, t: "Academics" },
    { s: "Refund status for cancelled trip", c: "fees" as const, t: "Accounts" },
  ];
  const statuses = ["new", "open", "in-progress", "waiting-on-requester", "escalated", "resolved", "closed"] as const;
  const priorities = ["low", "normal", "high", "urgent"] as const;
  const tickets: HelpdeskTicket[] = ticketSubjects.map((ts, i) => {
    const student = helpers.pick(contextStudents);
    const status = i < 6 ? helpers.pick(["new", "open", "in-progress", "waiting-on-requester", "escalated"] as const) : helpers.pick(statuses);
    return {
      id: `tkt-${i + 1}`,
      reference: `TKT-${String(i + 1).padStart(4, "0")}`,
      subject: ts.s,
      requesterName: helpers.bool() ? `${helpers.pick(firstNamesMale)} ${student.profile.lastName}` : student.profile.firstName + " " + student.profile.lastName,
      requesterRole: helpers.pick(["parent", "student", "teacher", "staff"] as const),
      studentId: helpers.bool(0.7) ? student.id : undefined,
      category: ts.c,
      assignedTeam: ts.t,
      assignedTo: status === "new" ? undefined : "Support Agent",
      priority: i === 2 || i === 3 ? "urgent" : helpers.pick(priorities),
      status,
      slaHours: helpers.pick([4, 8, 24, 48]),
      createdAt: time(helpers.int(2, 96)),
      lastActivityAt: time(helpers.int(0, 48)),
    };
  });

  const replies: TicketReply[] = tickets.flatMap((tkt, i) => {
    const out: TicketReply[] = [{ id: `rep-${i}-0`, ticketId: tkt.id, authorName: tkt.requesterName, fromStaff: false, internal: false, body: `Hi, I'm facing an issue: ${tkt.subject.toLowerCase()}. Please help.`, createdAt: tkt.createdAt }];
    if (tkt.status !== "new") out.push({ id: `rep-${i}-1`, ticketId: tkt.id, authorName: "Support Agent", fromStaff: true, internal: false, body: "Thanks for reaching out — we're looking into this and will update you shortly.", createdAt: time(helpers.int(1, 40)) });
    if (helpers.bool(0.4)) out.push({ id: `rep-${i}-2`, ticketId: tkt.id, authorName: "Support Agent", fromStaff: true, internal: true, body: "Internal: escalating to the relevant department.", createdAt: time(helpers.int(1, 30)) });
    return out;
  });

  const knowledge: KnowledgeArticle[] = [
    { id: "kb-1", title: "How to pay fees online", category: "fees", excerpt: "Step-by-step guide to paying term fees through the parent app.", views: 1420, helpfulPercent: 94, updatedAt: time(120) },
    { id: "kb-2", title: "Resetting your parent app password", category: "parent-portal", excerpt: "Recover access to your parent account in a few steps.", views: 980, helpfulPercent: 89, updatedAt: time(200) },
    { id: "kb-3", title: "Understanding the report card", category: "exams", excerpt: "What each section of the report card means.", views: 760, helpfulPercent: 92, updatedAt: time(300) },
    { id: "kb-4", title: "Applying for student leave", category: "attendance", excerpt: "How to submit and track a leave application.", views: 540, helpfulPercent: 88, updatedAt: time(150) },
    { id: "kb-5", title: "Tracking the school bus", category: "transport", excerpt: "Live-track your child's bus from the app.", views: 1100, helpfulPercent: 95, updatedAt: time(90) },
    { id: "kb-6", title: "Borrowing and returning library books", category: "library", excerpt: "Loan limits, due dates and renewals explained.", views: 430, helpfulPercent: 90, updatedAt: time(210) },
    { id: "kb-7", title: "Admission enquiry process", category: "admissions", excerpt: "How to apply and what documents are needed.", views: 1680, helpfulPercent: 91, updatedAt: time(60) },
    { id: "kb-8", title: "Staff portal quick start", category: "staff-portal", excerpt: "Getting started with the staff workspace.", views: 320, helpfulPercent: 87, updatedAt: time(180) },
  ];

  // ---- Front desk ----
  const hosts = teachers.slice(0, 8).map((t) => t.name);
  const visitors: Visitor[] = Array.from({ length: 12 }, (_, i) => {
    const female = helpers.bool();
    const type = helpers.pick(["parent", "vendor", "guest", "contractor", "interview-candidate", "official"] as const);
    const status = i < 4 ? helpers.pick(["waiting", "checked-in", "meeting"] as const) : helpers.pick(["expected", "checked-in", "checked-out", "checked-out"] as const);
    return {
      id: `vis-${i + 1}`,
      visitorNumber: `V-${TODAY.replace(/-/g, "")}-${String(i + 1).padStart(3, "0")}`,
      name: `${helpers.pick(female ? firstNamesFemale : firstNamesMale)} ${helpers.pick(lastNames)}`,
      phone: `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}`,
      organization: type === "vendor" || type === "contractor" ? helpers.pick(["Stationery World", "BuildRight Co", "TechServe", "CleanPro"]) : undefined,
      purpose: type === "parent" ? "Meet class teacher" : type === "interview-candidate" ? "Interview" : type === "vendor" ? "Delivery & invoice" : "Official visit",
      hostName: helpers.pick(hosts),
      department: helpers.pick(["Academics", "Administration", "Accounts", "HR", "Principal Office"]),
      type,
      date: TODAY,
      arrivalTime: status === "expected" ? undefined : `${helpers.int(9, 15)}:${helpers.pick(["05", "15", "30", "45"])}`,
      departureTime: status === "checked-out" ? `${helpers.int(11, 17)}:${helpers.pick(["10", "20", "40"])}` : undefined,
      vehicleNumber: helpers.bool(0.4) ? `KA-05-${helpers.pick(["AB", "MN", "XZ"])}-${helpers.int(1000, 9999)}` : undefined,
      badgeCode: `BADGE${helpers.int(1000, 9999)}`,
      status,
      createdAt: TODAY,
    };
  });

  const appointmentTypes = ["parent-meeting", "principal-meeting", "teacher-meeting", "admission-enquiry", "vendor-meeting", "interview", "counselling"] as const;
  const appointments: VisitorAppointment[] = Array.from({ length: 8 }, (_, i) => ({
    id: `apt-${i + 1}`,
    visitorName: `${helpers.pick([...firstNamesMale, ...firstNamesFemale])} ${helpers.pick(lastNames)}`,
    hostName: helpers.pick(hosts),
    type: helpers.pick(appointmentTypes),
    purpose: helpers.pick(["Discuss progress", "Admission enquiry", "Vendor contract", "Interview round", "Counselling session"]),
    date: helpers.bool(0.5) ? TODAY : helpers.daysFromNowIso(helpers.int(1, 6)).slice(0, 10),
    time: `${helpers.int(9, 16)}:${helpers.pick(["00", "30"])}`,
    durationMinutes: helpers.pick([30, 45, 60]),
    location: helpers.pick(["Reception", "Principal Office", "Meeting Room 1", "Counselling Room"]),
    status: helpers.pick(["scheduled", "confirmed", "completed"] as const),
    createdAt: TODAY,
  }));

  const gatePasses: GatePass[] = Array.from({ length: 8 }, (_, i) => {
    const isStudent = helpers.bool(0.6);
    const student = helpers.pick(contextStudents);
    const status = helpers.pick(["requested", "approved", "active", "returned", "rejected"] as const);
    return {
      id: `gp-${i + 1}`,
      reference: `GP-${String(i + 1).padStart(4, "0")}`,
      type: isStudent ? "student" : helpers.pick(["staff", "visitor", "material", "vehicle"] as const),
      subjectName: isStudent ? `${student.profile.firstName} ${student.profile.lastName}` : `${helpers.pick([...firstNamesMale, ...firstNamesFemale])} ${helpers.pick(lastNames)}`,
      classOrDept: isStudent ? student.classId : helpers.pick(["Administration", "Transport", "Maintenance"]),
      reason: helpers.pick(["Medical appointment", "Family emergency", "Early pickup", "Official work", "Material dispatch"]),
      requestedBy: helpers.pick(["Class Teacher", "Parent", "Department Head"]),
      authorizedBy: status === "requested" ? undefined : "Principal",
      guardianName: isStudent ? `${helpers.pick(firstNamesMale)} ${student.profile.lastName}` : undefined,
      exitTime: status === "active" || status === "returned" ? `${helpers.int(10, 15)}:${helpers.pick(["00", "30"])}` : undefined,
      expectedReturn: helpers.bool(0.5) ? `${helpers.int(15, 17)}:00` : undefined,
      status,
      createdAt: time(helpers.int(1, 24)),
    };
  });

  const calls: ReceptionCall[] = Array.from({ length: 10 }, (_, i) => ({
    id: `call-${i + 1}`,
    callerName: `${helpers.pick([...firstNamesMale, ...firstNamesFemale])} ${helpers.pick(lastNames)}`,
    phone: `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}`,
    type: helpers.pick(["parent", "admission-enquiry", "vendor", "staff", "general"] as const),
    relatedTo: helpers.bool(0.5) ? helpers.pick(contextStudents).profile.firstName : undefined,
    department: helpers.pick(["Academics", "Admissions", "Accounts", "Transport", "Reception"]),
    subject: helpers.pick(["Fee query", "Admission info", "Bus timing", "Meeting request", "General enquiry"]),
    receivedBy: "Reception",
    time: `${helpers.int(9, 16)}:${helpers.pick(["05", "20", "35", "50"])}`,
    outcome: helpers.pick(["resolved", "transferred", "callback-needed", "message-taken"] as const),
    followUpNeeded: helpers.bool(0.3),
  }));

  const deliveries: Delivery[] = Array.from({ length: 6 }, (_, i) => {
    const status = helpers.pick(["received", "awaiting-collection", "collected", "collected"] as const);
    return {
      id: `del-${i + 1}`,
      courier: helpers.pick(["BlueDart", "DTDC", "India Post", "Delhivery"]),
      sender: helpers.pick(["CBSE Board", "Stationery World", "Publisher House", "Govt Office"]),
      recipient: helpers.pick(["Principal Office", "Accounts", "Library", "Examination Cell"]),
      department: helpers.pick(["Administration", "Accounts", "Library", "Examination"]),
      packageCount: helpers.int(1, 4),
      arrivalTime: `${helpers.int(9, 15)}:${helpers.pick(["10", "25", "40"])}`,
      receivedBy: "Reception",
      collectedAt: status === "collected" ? `${helpers.int(11, 17)}:00` : undefined,
      status,
    };
  });

  const incidents: FrontDeskIncident[] = [
    { id: "fdi-1", title: "Unregistered visitor at gate", description: "Person without appointment requested entry; asked to register first.", severity: "medium", reportedBy: "Security", status: "resolved", createdAt: time(5) },
    { id: "fdi-2", title: "Lost & found — umbrella", description: "Black umbrella found near reception.", severity: "low", reportedBy: "Reception", status: "open", createdAt: time(2) },
  ];

  return {
    conversations,
    messages,
    participants,
    groups,
    announcements,
    notices,
    broadcasts,
    scheduled,
    templates,
    notifications,
    notificationSettings,
    tickets,
    replies,
    knowledge,
    visitors,
    appointments,
    gatePasses,
    calls,
    deliveries,
    incidents,
  };
}
