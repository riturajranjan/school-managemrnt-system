import type { ID } from "./common";
import type { Money } from "@/lib/finance/money";

// ===========================================================================
// Phase 10 — Cafeteria / Canteen. Frontend mock models only. No real payment,
// no medical safety guarantees from dietary labels.
// ===========================================================================

export type MealCategory = "breakfast" | "lunch" | "snacks" | "dinner" | "a-la-carte";

export const mealCategoryLabels: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
  "a-la-carte": "À la carte",
};

export type DietaryTag = "vegetarian" | "vegan" | "contains-dairy" | "contains-nuts" | "gluten-aware" | "jain" | "egg";

export const dietaryTagLabels: Record<DietaryTag, string> = {
  vegetarian: "Vegetarian",
  vegan: "Vegan",
  "contains-dairy": "Contains dairy",
  "contains-nuts": "Contains nuts",
  "gluten-aware": "Gluten-aware",
  jain: "Jain",
  egg: "Egg",
};

export type MenuItem = {
  id: ID;
  name: string;
  category: MealCategory;
  description: string;
  price: Money;
  available: boolean;
  dietaryTags: DietaryTag[];
  servingTime: string;
  counter: string;
  popular?: boolean;
  outOfStock?: boolean;
};

export type WeeklyMenuSlot = { day: string; category: MealCategory; itemIds: ID[] };

export type MealPlanType = "day-scholar-lunch" | "hostel-full" | "breakfast" | "lunch" | "snacks" | "dinner" | "monthly" | "custom";

export const mealPlanTypeLabels: Record<MealPlanType, string> = {
  "day-scholar-lunch": "Day scholar lunch",
  "hostel-full": "Hostel full meal",
  breakfast: "Breakfast",
  lunch: "Lunch",
  snacks: "Snacks",
  dinner: "Dinner",
  monthly: "Monthly plan",
  custom: "Custom plan",
};

export type MealPlan = {
  id: ID;
  name: string;
  type: MealPlanType;
  meals: MealCategory[];
  durationLabel: string;
  price: Money;
  enrolledCount: number;
  status: "active" | "inactive";
};

export type MealPlanEnrollment = {
  id: ID;
  planId: ID;
  studentId: ID;
  startDate: string;
  status: "active" | "paused" | "ended";
};

export type OrderStatus = "cart" | "placed" | "preparing" | "ready" | "collected" | "cancelled";

export const orderStatusLabels: Record<OrderStatus, string> = {
  cart: "Cart",
  placed: "Placed",
  preparing: "Preparing",
  ready: "Ready",
  collected: "Collected",
  cancelled: "Cancelled",
};

export const orderStatusTone: Record<OrderStatus, "success" | "warning" | "error" | "info" | "neutral"> = {
  cart: "neutral",
  placed: "info",
  preparing: "warning",
  ready: "success",
  collected: "neutral",
  cancelled: "error",
};

export type CafeteriaOrderItem = { menuItemId: ID; name: string; quantity: number; price: Money };

export type CafeteriaOrder = {
  id: ID;
  orderNumber: string;
  studentName: string;
  studentId?: ID;
  items: CafeteriaOrderItem[];
  total: Money;
  counter: string;
  pickupTime: string;
  status: OrderStatus;
  tokenCode: string;
  createdAt: string;
};

export type CafeteriaCounter = {
  id: ID;
  name: string;
  categories: MealCategory[];
  active: boolean;
  queueMock: number;
};

export type CafeteriaFeedback = {
  id: ID;
  studentName: string;
  rating: number;
  comment: string;
  category: MealCategory;
  createdAt: string;
};

export type CafeteriaInventoryItem = {
  id: ID;
  name: string;
  unit: string;
  quantity: number;
  reorderLevel: number;
  status: "in-stock" | "low-stock" | "out-of-stock";
};
