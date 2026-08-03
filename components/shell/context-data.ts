// Placeholder multi-tenant/session data shared by every switcher surface
// (header, sidebar, mobile context sheet) — real lists come from the
// account/session API once auth + backend exist.
export const MOCK_SCHOOLS = [
  { id: "novyra-intl", name: "Novyra International" },
  { id: "greenwood", name: "Greenwood Academy" },
  { id: "riverdale", name: "Riverdale Public School" },
];

export const MOCK_BRANCHES = [
  { id: "main", name: "Main Campus" },
  { id: "north-wing", name: "North Wing" },
  { id: "city-extension", name: "City Extension" },
];

export const MOCK_SESSIONS = ["2026-2027", "2025-2026", "2024-2025"];
