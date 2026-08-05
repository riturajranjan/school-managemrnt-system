// No auth/session exists yet — every /teacher/* screen operates as this
// fixed demo teacher so "My Day", "My classes" etc. have a consistent
// identity to filter against. Swap for a real session lookup once auth ships.
export const CURRENT_TEACHER_ID = "teacher-1";
export const CURRENT_TEACHER_NAME = "Meera Krishnan";
