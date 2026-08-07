import type { Student } from "@/lib/types/students";
import type {
  HostelAllocation,
  HostelAttendance,
  HostelBed,
  HostelBuilding,
  HostelComplaint,
  HostelFloor,
  HostelLeave,
  HostelMaintenance,
  HostelMess,
  HostelRoom,
  HostelVisitor,
  RoomStatus,
  RoomType,
} from "@/lib/types/hostel";
import type {
  CounsellingAppointment,
  CounsellingResource,
  HealthAppointment,
  HealthIncident,
  HealthProfile,
  HealthVisit,
  MedicationRecord,
} from "@/lib/types/health";
import type {
  CafeteriaCounter,
  CafeteriaFeedback,
  CafeteriaInventoryItem,
  CafeteriaOrder,
  DietaryTag,
  MealPlan,
  MealPlanEnrollment,
  MenuItem,
  WeeklyMenuSlot,
} from "@/lib/types/cafeteria";
import { moneyFromMajor } from "@/lib/finance/money";
import { firstNamesFemale, firstNamesMale, lastNames } from "./names";
import { seededHelpers } from "./rng";

const helpers = seededHelpers(12082026);
const TODAY = "2026-08-05";
const BRANCH = "main";

function daysAgo(n: number) { return helpers.daysAgoIso(n).slice(0, 10); }
function daysFromNow(n: number) { return helpers.daysFromNowIso(n).slice(0, 10); }
function isoTime(hoursAgo: number) { const d = new Date("2026-08-05T14:00:00Z"); d.setHours(d.getHours() - hoursAgo); return d.toISOString(); }

export function buildCampusData(students: Student[]) {
  // -------------------------------------------------------------------------
  // Hostel — buildings, floors, rooms, beds
  // -------------------------------------------------------------------------
  const buildings: HostelBuilding[] = [
    { id: "hb-1", name: "Tagore Boys Hostel", code: "TBH", type: "boys", floors: 3, wardenName: "Suresh Pillai", assistantWardenName: "Anil Deshpande", status: "active", branch: BRANCH, createdAt: TODAY },
    { id: "hb-2", name: "Kalpana Girls Hostel", code: "KGH", type: "girls", floors: 3, wardenName: "Kavita Nambiar", assistantWardenName: "Farah Sheikh", status: "partial", branch: BRANCH, createdAt: TODAY },
    { id: "hb-3", name: "Junior Wing", code: "JRW", type: "junior", floors: 2, wardenName: "Priya Ramesh", status: "active", branch: BRANCH, createdAt: TODAY },
  ];

  const floors: HostelFloor[] = [];
  const rooms: HostelRoom[] = [];
  const beds: HostelBed[] = [];
  const facilities = ["Attached bath", "Study desk", "Wardrobe", "Balcony", "AC", "Wi-Fi"];
  const roomTypes: { type: RoomType; cap: number }[] = [{ type: "double", cap: 2 }, { type: "triple", cap: 3 }, { type: "four-bed", cap: 4 }, { type: "single", cap: 1 }];

  let roomCounter = 0;
  let bedCounter = 0;
  for (const b of buildings) {
    for (let f = 1; f <= b.floors; f++) {
      const floorId = `${b.id}-f${f}`;
      floors.push({ id: floorId, buildingId: b.id, number: f, name: `Floor ${f}` });
      const roomsPerFloor = helpers.int(5, 7);
      for (let r = 1; r <= roomsPerFloor; r++) {
        roomCounter++;
        const rt = helpers.pick(roomTypes);
        const roomId = `room-${roomCounter}`;
        const roomStatus: RoomStatus = helpers.rand() < 0.08 ? "maintenance" : "available";
        rooms.push({ id: roomId, buildingId: b.id, floorId, roomNumber: `${f}${String(r).padStart(2, "0")}`, type: rt.type, capacity: rt.cap, facilities: helpers.pickMany(facilities, helpers.int(2, 4)), status: roomStatus });
        for (let p = 0; p < rt.cap; p++) {
          bedCounter++;
          beds.push({ id: `bed-${bedCounter}`, roomId, position: String.fromCharCode(65 + p), status: roomStatus === "maintenance" ? "maintenance" : "available" });
        }
      }
    }
  }

  // Allocate a subset of students to beds (no double allocation). The rest are
  // day scholars, so some students remain unallocated for allocation flows.
  const boarders = students.slice(0, Math.min(48, Math.floor(students.length * 0.66)));
  const allocations: HostelAllocation[] = [];
  const availableBeds = beds.filter((bd) => bd.status === "available");
  boarders.forEach((s, i) => {
    if (i >= availableBeds.length) return;
    const bed = availableBeds[i];
    const room = rooms.find((r) => r.id === bed.roomId)!;
    bed.status = "occupied";
    bed.studentId = s.id;
    bed.allocationDate = daysAgo(helpers.int(30, 200));
    allocations.push({ id: `alloc-${i + 1}`, studentId: s.id, buildingId: room.buildingId, roomId: room.id, bedId: bed.id, allocatedAt: bed.allocationDate, status: "active" });
  });

  // Recompute room status from bed occupancy.
  for (const room of rooms) {
    if (room.status === "maintenance") continue;
    const roomBeds = beds.filter((bd) => bd.roomId === room.id);
    const occ = roomBeds.filter((bd) => bd.status === "occupied").length;
    room.status = occ === 0 ? "available" : occ >= room.capacity ? "full" : "partial";
  }

  const allocatedStudentIds = allocations.map((a) => a.studentId);
  const studentName = (id: string) => { const s = students.find((x) => x.id === id); return s ? `${s.profile.firstName} ${s.profile.lastName}` : id; };

  // Hostel attendance for tonight.
  const attendance: HostelAttendance[] = allocatedStudentIds.map((sid, i) => {
    const roll = helpers.rand();
    const status = roll < 0.8 ? "present" : roll < 0.88 ? "on-leave" : roll < 0.93 ? "infirmary" : roll < 0.97 ? "official-activity" : "not-checked-in";
    return { id: `hatt-${i}`, studentId: sid, date: TODAY, status, checkInTime: status === "present" ? `${helpers.int(18, 21)}:${helpers.pick(["05", "20", "45"])}` : undefined };
  });

  // Leave requests.
  const leave: HostelLeave[] = helpers.pickMany(allocatedStudentIds, 16).map((sid, i) => {
    const roll = helpers.rand();
    const status = roll < 0.3 ? "requested" : roll < 0.5 ? "parent-confirmed" : roll < 0.75 ? "approved" : roll < 0.85 ? "active" : roll < 0.95 ? "returned" : "overdue";
    return { id: `hleave-${i + 1}`, studentId: sid, type: helpers.pick(["home", "weekend", "medical", "emergency", "day-out"] as const), fromDate: daysFromNow(helpers.int(-3, 5)), toDate: daysFromNow(helpers.int(6, 10)), reason: helpers.pick(["Family function", "Not well", "Home visit", "Festival", "Medical checkup"]), destination: helpers.pick(["Home", "Grandparents", "Hospital", "Relative's place"]), guardianName: `${helpers.pick(firstNamesMale)} ${students.find((s) => s.id === sid)?.profile.lastName ?? ""}`, pickupPerson: helpers.pick(["Father", "Mother", "Uncle", "Guardian"]), expectedReturn: daysFromNow(helpers.int(6, 11)), status, createdAt: daysAgo(helpers.int(1, 8)) };
  });

  // Hostel visitors.
  const visitors: HostelVisitor[] = helpers.pickMany(allocatedStudentIds, 8).map((sid, i) => {
    const status = helpers.pick(["waiting", "approved", "with-student", "departed", "expected"] as const);
    return { id: `hvis-${i + 1}`, studentId: sid, visitorName: `${helpers.pick([...firstNamesMale, ...firstNamesFemale])} ${students.find((s) => s.id === sid)?.profile.lastName ?? ""}`, relation: helpers.pick(["Father", "Mother", "Sibling", "Guardian"]), arrivalTime: status === "expected" ? undefined : `${helpers.int(10, 17)}:${helpers.pick(["00", "30"])}`, departureTime: status === "departed" ? `${helpers.int(11, 18)}:${helpers.pick(["15", "45"])}` : undefined, purpose: helpers.pick(["Weekend visit", "Drop essentials", "Meeting", "Checkup"]), approvedBy: status === "expected" || status === "waiting" ? undefined : "Warden", status, date: TODAY };
  });

  // Complaints.
  const complaintCats = ["electricity", "water", "furniture", "cleaning", "bathroom", "wifi", "roommate", "safety"] as const;
  const complaints: HostelComplaint[] = helpers.pickMany(allocations, 12).map((a, i) => {
    const status = helpers.pick(["new", "assigned", "in-progress", "resolved", "closed"] as const);
    return { id: `hcomp-${i + 1}`, reference: `HC-${String(i + 1).padStart(4, "0")}`, studentId: a.studentId, roomId: a.roomId, category: helpers.pick(complaintCats), description: helpers.pick(["Fan not working", "Low water pressure", "Broken chair", "Room needs cleaning", "Leaking tap", "Slow Wi-Fi", "Noise from roommate", "Loose window latch"]), priority: helpers.pick(["low", "normal", "high", "urgent"] as const), assignedTeam: helpers.pick(["Electrical", "Plumbing", "Housekeeping", "IT", "Warden"]), status, createdAt: isoTime(helpers.int(2, 72)), lastUpdate: isoTime(helpers.int(0, 24)) };
  });

  // Maintenance.
  const maintenance: HostelMaintenance[] = helpers.pickMany(rooms, 10).map((r, i) => {
    const status = helpers.pick(["new", "assigned", "in-progress", "resolved", "closed"] as const);
    return { id: `hmnt-${i + 1}`, roomId: r.id, issue: helpers.pick(["Replace tube light", "Fix door lock", "Repair window", "Service AC", "Fix water heater", "Repaint wall"]), category: helpers.pick(complaintCats), priority: helpers.pick(["low", "normal", "high", "urgent"] as const), assignedTo: status === "new" ? undefined : helpers.pick(["Ramesh (Electrician)", "Suresh (Plumber)", "Facilities Team"]), createdAt: isoTime(helpers.int(4, 96)), eta: status === "resolved" || status === "closed" ? undefined : daysFromNow(helpers.int(1, 4)), status };
  });

  // Mess for today + a couple of days.
  const mess: HostelMess[] = Array.from({ length: 3 }, (_, i) => ({
    id: `mess-${i}`,
    date: daysFromNow(i),
    breakfast: { name: "Breakfast", items: helpers.pickMany(["Idli & sambar", "Poha", "Bread & jam", "Boiled eggs", "Upma", "Cornflakes", "Banana"], 3) },
    lunch: { name: "Lunch", items: helpers.pickMany(["Rice", "Dal", "Mixed veg", "Roti", "Curd", "Salad", "Paneer curry"], 4) },
    snacks: { name: "Snacks", items: helpers.pickMany(["Samosa", "Tea", "Biscuits", "Fruit", "Sandwich"], 2) },
    dinner: { name: "Dinner", items: helpers.pickMany(["Roti", "Rajma", "Jeera rice", "Veg curry", "Kheer", "Papad"], 4) },
    specialMenu: i === 0 && helpers.bool(0.5) ? "Special: Veg Biryani" : undefined,
    expectedStudents: allocatedStudentIds.length,
    attendanceMock: Math.round(allocatedStudentIds.length * (0.8 + helpers.rand() * 0.15)),
  }));

  // -------------------------------------------------------------------------
  // Health — profiles, visits, incidents, medications, appointments
  // -------------------------------------------------------------------------
  const bloodGroups = ["A+", "B+", "O+", "AB+", "A-", "O-"];
  const commonAllergies = ["Peanuts", "Dust", "Pollen", "Penicillin", "Lactose", "Shellfish"];
  const profiles: HealthProfile[] = students.slice(0, 120).map((s) => ({
    studentId: s.id,
    bloodGroup: helpers.bool(0.85) ? helpers.pick(bloodGroups) : undefined,
    allergies: helpers.bool(0.3) ? helpers.pickMany(commonAllergies, helpers.int(1, 2)) : [],
    careInstructions: helpers.bool(0.15) ? "Keep inhaler accessible during sports." : undefined,
    physicianName: helpers.bool(0.5) ? `Dr. ${helpers.pick(lastNames)}` : undefined,
    physicianPhone: helpers.bool(0.5) ? `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}` : undefined,
    insuranceProvider: helpers.bool(0.4) ? helpers.pick(["Star Health", "HDFC Ergo", "New India", "ICICI Lombard"]) : undefined,
    insuranceNumberMasked: helpers.bool(0.4) ? `••••${helpers.int(1000, 9999)}` : undefined,
    emergencyContactName: `${helpers.pick(firstNamesMale)} ${s.profile.lastName}`,
    emergencyContactPhone: `+91 ${helpers.int(70000, 99999)} ${helpers.int(10000, 99999)}`,
    lastUpdated: daysAgo(helpers.int(20, 300)),
    immunisations: [{ name: "Tetanus", date: daysAgo(helpers.int(200, 700)), status: "recorded" as const }, { name: "Hepatitis B", date: daysAgo(helpers.int(400, 900)), status: "recorded" as const }],
  }));

  const visitReasons = ["Headache", "Stomach ache", "Fever", "Minor cut", "Sprained ankle", "Feeling unwell", "Nausea", "Cold & cough"];
  const visits: HealthVisit[] = [];
  // Today's live board (a handful currently active) + history.
  helpers.pickMany(students.slice(0, 120), 6).forEach((s, i) => {
    const status = helpers.pick(["waiting", "being-seen", "resting", "returning-to-class"] as const);
    visits.push({ id: `hv-today-${i}`, studentId: s.id, arrivalAt: isoTime(helpers.int(0, 5)), reason: helpers.pick(visitReasons), symptomsReported: helpers.pick(["Mild headache", "Feeling tired", "Slight fever", "Minor pain"]), observationNotes: "Stable, monitored.", careAction: helpers.pick(["Rest provided", "Cold compress applied", "Water & rest", "Guardian informed"]), restStart: status === "resting" ? isoTime(1) : undefined, guardianContacted: helpers.bool(0.4), referredExternally: false, staffName: "Nurse Anita", status });
  });
  helpers.pickMany(students.slice(0, 120), 20).forEach((s, i) => {
    visits.push({ id: `hv-${i}`, studentId: s.id, arrivalAt: isoTime(helpers.int(24, 400)), reason: helpers.pick(visitReasons), observationNotes: "Recovered, returned to class.", careAction: "Basic care provided", guardianContacted: helpers.bool(0.3), referredExternally: helpers.bool(0.05), followUpDate: helpers.bool(0.2) ? daysFromNow(helpers.int(1, 5)) : undefined, staffName: "Nurse Anita", status: "completed" });
  });

  const incidents: HealthIncident[] = helpers.pickMany(students.slice(0, 120), 8).map((s, i) => {
    const status = helpers.pick(["open", "monitoring", "guardian-contacted", "referred", "resolved", "closed"] as const);
    return { id: `hi-${i + 1}`, reference: `INC-${String(i + 1).padStart(4, "0")}`, studentId: s.id, type: helpers.pick(["injury", "illness-reported", "sports-incident", "playground-incident", "classroom-incident"] as const), occurredAt: isoTime(helpers.int(1, 120)), location: helpers.pick(["Playground", "Sports field", "Classroom 7A", "Corridor", "Stairs"]), reportedBy: helpers.pick(["PE Teacher", "Class Teacher", "Supervisor"]), description: helpers.pick(["Fell during play", "Twisted ankle in PE", "Complained of dizziness", "Minor cut on hand"]), immediateAction: helpers.pick(["First aid applied", "Sent to infirmary", "Rest advised", "Guardian informed"]), guardianContacted: helpers.bool(0.6), externalReferral: helpers.bool(0.1), followUpDate: helpers.bool(0.3) ? daysFromNow(helpers.int(1, 4)) : undefined, status };
  });

  const medications: MedicationRecord[] = helpers.pickMany(students.slice(0, 120), 10).flatMap((s, i) => {
    const times = ["08:00", "13:00"];
    return times.map((t, j) => {
      const status = j === 0 ? helpers.pick(["recorded", "recorded", "due"] as const) : helpers.pick(["scheduled", "due", "held"] as const);
      return { id: `med-${i}-${j}`, studentId: s.id, medicationName: helpers.pick(["Cetirizine (as recorded)", "Salbutamol inhaler (as recorded)", "Vitamin supplement (as recorded)"]), guardianAuthorised: true, scheduleLabel: "Daily", scheduledTime: t, doseAsRecorded: "As per guardian authorisation", instructionsAsRecorded: "After food", status, administeredAt: status === "recorded" ? isoTime(helpers.int(1, 6)) : undefined, staffName: status === "recorded" ? "Nurse Anita" : undefined, date: TODAY };
    });
  });

  const healthAppointments: HealthAppointment[] = helpers.pickMany(students.slice(0, 120), 6).map((s, i) => ({ id: `hap-${i + 1}`, studentId: s.id, purpose: helpers.pick(["Follow-up checkup", "Dressing change", "Routine review"]), date: daysFromNow(helpers.int(0, 5)), time: `${helpers.int(9, 15)}:${helpers.pick(["00", "30"])}`, staffName: "Nurse Anita", status: helpers.pick(["scheduled", "requested", "completed"] as const) }));

  // -------------------------------------------------------------------------
  // Counselling — appointments, resources
  // -------------------------------------------------------------------------
  const counsellingAppointments: CounsellingAppointment[] = helpers.pickMany(students.slice(0, 120), 12).map((s, i) => {
    const status = helpers.pick(["requested", "scheduled", "completed", "rescheduled", "follow-up"] as const);
    return { id: `cap-${i + 1}`, studentId: s.id, counsellorName: helpers.pick(["Ms. Deshmukh", "Mr. Varghese"]), date: daysFromNow(helpers.int(-2, 7)), time: `${helpers.int(9, 15)}:${helpers.pick(["00", "30"])}`, type: helpers.pick(["self-referral", "teacher-referral", "parent-referral", "routine-checkin", "career-guidance", "academic-support"] as const), adminReasonCategory: helpers.pick(["Academic support", "Career guidance", "Routine check-in", "Adjustment support", "Time management"]), status, privateNotePlaceholder: "Private session notes (counsellor access only).", followUpDate: helpers.bool(0.3) ? daysFromNow(helpers.int(7, 21)) : undefined };
  });

  const counsellingResources: CounsellingResource[] = [
    { id: "cr-1", title: "Effective Study Habits", category: "study-habits", description: "Building consistent, focused study routines.", format: "article", updatedAt: daysAgo(30) },
    { id: "cr-2", title: "Managing Exam Stress", category: "exam-preparation", description: "Healthy preparation and calm-down techniques.", format: "worksheet", updatedAt: daysAgo(45) },
    { id: "cr-3", title: "Time Management for Students", category: "time-management", description: "Planning your week and beating procrastination.", format: "video", updatedAt: daysAgo(60) },
    { id: "cr-4", title: "Settling into a New School", category: "school-adjustment", description: "Tips for new students to feel at home.", format: "article", updatedAt: daysAgo(20) },
    { id: "cr-5", title: "Talking to Teachers & Peers", category: "communication-skills", description: "Building confident communication.", format: "article", updatedAt: daysAgo(90) },
    { id: "cr-6", title: "Exploring Careers", category: "career-exploration", description: "Understanding your interests and pathways.", format: "link", updatedAt: daysAgo(15) },
    { id: "cr-7", title: "Standing Up to Bullying", category: "anti-bullying", description: "What to do and who to talk to.", format: "worksheet", updatedAt: daysAgo(25) },
    { id: "cr-8", title: "Staying Safe Online", category: "digital-safety", description: "Privacy, screen time and online kindness.", format: "video", updatedAt: daysAgo(40) },
    { id: "cr-9", title: "Everyday Wellbeing", category: "general-wellbeing", description: "Sleep, activity and balance for students.", format: "article", updatedAt: daysAgo(10) },
  ];

  // -------------------------------------------------------------------------
  // Cafeteria — menu, weekly plan, meal plans, orders, counters, feedback
  // -------------------------------------------------------------------------
  const menuSeed: { name: string; cat: MenuItem["category"]; price: number; tags: DietaryTag[]; counter: string; time: string }[] = [
    { name: "Masala Dosa", cat: "breakfast", price: 45, tags: ["vegetarian", "contains-dairy"], counter: "South Indian", time: "07:30–09:30" },
    { name: "Aloo Paratha", cat: "breakfast", price: 40, tags: ["vegetarian", "contains-dairy", "gluten-aware"], counter: "North Indian", time: "07:30–09:30" },
    { name: "Boiled Eggs (2)", cat: "breakfast", price: 25, tags: ["egg"], counter: "Express", time: "07:30–09:30" },
    { name: "Veg Thali", cat: "lunch", price: 80, tags: ["vegetarian", "contains-dairy"], counter: "Main", time: "12:00–14:00" },
    { name: "Paneer Butter Masala + Rice", cat: "lunch", price: 95, tags: ["vegetarian", "contains-dairy", "contains-nuts"], counter: "Main", time: "12:00–14:00" },
    { name: "Rajma Chawal", cat: "lunch", price: 70, tags: ["vegetarian", "vegan"], counter: "Main", time: "12:00–14:00" },
    { name: "Veg Sandwich", cat: "snacks", price: 35, tags: ["vegetarian", "gluten-aware"], counter: "Express", time: "15:30–17:00" },
    { name: "Samosa (2)", cat: "snacks", price: 30, tags: ["vegetarian"], counter: "Express", time: "15:30–17:00" },
    { name: "Fruit Bowl", cat: "snacks", price: 40, tags: ["vegetarian", "vegan"], counter: "Healthy", time: "15:30–17:00" },
    { name: "Roti + Dal + Sabzi", cat: "dinner", price: 75, tags: ["vegetarian"], counter: "Main", time: "19:30–21:00" },
    { name: "Jeera Rice + Kadhi", cat: "dinner", price: 70, tags: ["vegetarian", "contains-dairy"], counter: "Main", time: "19:30–21:00" },
    { name: "Cold Coffee", cat: "a-la-carte", price: 50, tags: ["vegetarian", "contains-dairy"], counter: "Beverages", time: "All day" },
    { name: "Masala Chai", cat: "a-la-carte", price: 20, tags: ["vegetarian", "contains-dairy"], counter: "Beverages", time: "All day" },
    { name: "Nutri Salad", cat: "a-la-carte", price: 55, tags: ["vegetarian", "vegan"], counter: "Healthy", time: "All day" },
  ];
  const menuItems: MenuItem[] = menuSeed.map((m, i) => ({ id: `mi-${i + 1}`, name: m.name, category: m.cat, description: `Freshly prepared ${m.name.toLowerCase()}.`, price: moneyFromMajor(m.price, "INR"), available: helpers.bool(0.92), dietaryTags: m.tags, servingTime: m.time, counter: m.counter, popular: helpers.bool(0.3), outOfStock: helpers.bool(0.08) }));

  const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const weeklyMenu: WeeklyMenuSlot[] = weekDays.flatMap((day) => (["breakfast", "lunch", "snacks", "dinner"] as const).map((cat) => ({ day, category: cat, itemIds: helpers.pickMany(menuItems.filter((m) => m.category === cat), Math.min(2, menuItems.filter((m) => m.category === cat).length)).map((m) => m.id) })));

  const mealPlans: MealPlan[] = [
    { id: "mp-1", name: "Day Scholar Lunch", type: "day-scholar-lunch", meals: ["lunch"], durationLabel: "Monthly", price: moneyFromMajor(1800, "INR"), enrolledCount: helpers.int(120, 200), status: "active" },
    { id: "mp-2", name: "Hostel Full Meal", type: "hostel-full", meals: ["breakfast", "lunch", "snacks", "dinner"], durationLabel: "Monthly", price: moneyFromMajor(4500, "INR"), enrolledCount: allocatedStudentIds.length, status: "active" },
    { id: "mp-3", name: "Breakfast Only", type: "breakfast", meals: ["breakfast"], durationLabel: "Monthly", price: moneyFromMajor(900, "INR"), enrolledCount: helpers.int(40, 90), status: "active" },
    { id: "mp-4", name: "Snacks Plan", type: "snacks", meals: ["snacks"], durationLabel: "Monthly", price: moneyFromMajor(700, "INR"), enrolledCount: helpers.int(30, 70), status: "inactive" },
  ];

  const mealPlanEnrollments: MealPlanEnrollment[] = allocatedStudentIds.map((sid, i) => ({ id: `mpe-${i}`, planId: "mp-2", studentId: sid, startDate: daysAgo(helpers.int(30, 120)), status: "active" }));

  const counters: CafeteriaCounter[] = [
    { id: "cc-1", name: "Main", categories: ["lunch", "dinner"], active: true, queueMock: helpers.int(0, 12) },
    { id: "cc-2", name: "Express", categories: ["breakfast", "snacks"], active: true, queueMock: helpers.int(0, 8) },
    { id: "cc-3", name: "South Indian", categories: ["breakfast"], active: true, queueMock: helpers.int(0, 6) },
    { id: "cc-4", name: "Healthy", categories: ["snacks", "a-la-carte"], active: true, queueMock: helpers.int(0, 4) },
    { id: "cc-5", name: "Beverages", categories: ["a-la-carte"], active: false, queueMock: 0 },
  ];

  const orders: CafeteriaOrder[] = Array.from({ length: 10 }, (_, i) => {
    const its = helpers.pickMany(menuItems.filter((m) => m.available), helpers.int(1, 3));
    const items = its.map((m) => ({ menuItemId: m.id, name: m.name, quantity: helpers.int(1, 2), price: m.price }));
    const totalMinor = items.reduce((s, it) => s + it.price.minorUnits * it.quantity, 0);
    const status = helpers.pick(["placed", "preparing", "ready", "collected", "collected"] as const);
    const s = helpers.pick(students.slice(0, 120));
    return { id: `ord-${i + 1}`, orderNumber: `ORD-${String(i + 1).padStart(4, "0")}`, studentName: `${s.profile.firstName} ${s.profile.lastName}`, studentId: s.id, items, total: { minorUnits: totalMinor, currency: "INR" }, counter: helpers.pick(counters).name, pickupTime: `${helpers.int(12, 16)}:${helpers.pick(["00", "15", "30"])}`, status, tokenCode: `TKN${helpers.int(1000, 9999)}`, createdAt: isoTime(helpers.int(0, 6)) };
  });

  const feedback: CafeteriaFeedback[] = Array.from({ length: 8 }, (_, i) => { const s = helpers.pick(students.slice(0, 120)); return { id: `cf-${i + 1}`, studentName: `${s.profile.firstName} ${s.profile.lastName}`, rating: helpers.int(3, 5), comment: helpers.pick(["Loved the paneer today!", "Dosa was crispy and fresh.", "Please add more veg options.", "Salad bar is great.", "Chai could be hotter.", "Good portion sizes."]), category: helpers.pick(["breakfast", "lunch", "snacks", "dinner"] as const), createdAt: isoTime(helpers.int(1, 48)) }; });

  const inventory: CafeteriaInventoryItem[] = [
    { id: "ci-1", name: "Rice", unit: "kg", quantity: 220, reorderLevel: 100, status: "in-stock" },
    { id: "ci-2", name: "Wheat Flour", unit: "kg", quantity: 80, reorderLevel: 100, status: "low-stock" },
    { id: "ci-3", name: "Paneer", unit: "kg", quantity: 12, reorderLevel: 20, status: "low-stock" },
    { id: "ci-4", name: "Milk", unit: "L", quantity: 0, reorderLevel: 50, status: "out-of-stock" },
    { id: "ci-5", name: "Cooking Oil", unit: "L", quantity: 60, reorderLevel: 40, status: "in-stock" },
    { id: "ci-6", name: "Vegetables (mixed)", unit: "kg", quantity: 95, reorderLevel: 60, status: "in-stock" },
    { id: "ci-7", name: "Tea Leaves", unit: "kg", quantity: 8, reorderLevel: 10, status: "low-stock" },
  ];

  return {
    buildings, floors, rooms, beds, allocations, attendance, leave, visitors, complaints, maintenance, mess,
    profiles, visits, incidents, medications, healthAppointments,
    counsellingAppointments, counsellingResources,
    menuItems, weeklyMenu, mealPlans, mealPlanEnrollments, counters, orders, feedback, inventory,
  };
}
