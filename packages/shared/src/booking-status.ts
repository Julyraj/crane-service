export const BOOKING_STATUSES = [
  "requested",
  "confirmed",
  "assigned",
  "en_route",
  "on_site",
  "in_progress",
  "completed",
  "cancelled",
] as const;
export type BookingStatus = (typeof BOOKING_STATUSES)[number];

export type Role = "customer" | "operator" | "admin";

export const STATUS_LABELS: Record<BookingStatus, string> = {
  requested: "Requested",
  confirmed: "Confirmed",
  assigned: "Crane assigned",
  en_route: "On the way",
  on_site: "Arrived at site",
  in_progress: "Lifting in progress",
  completed: "Completed",
  cancelled: "Cancelled",
};

/** Allowed transitions and the roles that may perform them. */
export const TRANSITIONS: Record<BookingStatus, Partial<Record<BookingStatus, Role[]>>> = {
  requested: { confirmed: ["admin"], cancelled: ["customer", "admin"] },
  confirmed: { assigned: ["admin"], cancelled: ["customer", "admin"] },
  assigned: { assigned: ["admin"], en_route: ["operator", "admin"], cancelled: ["customer", "admin"] },
  en_route: { on_site: ["operator", "admin"], cancelled: ["admin"] },
  on_site: { in_progress: ["operator"], cancelled: ["admin"] },
  in_progress: { completed: ["operator", "admin"] },
  completed: {},
  cancelled: {},
};

export function canTransition(from: BookingStatus, to: BookingStatus, role: Role): boolean {
  return TRANSITIONS[from]?.[to]?.includes(role) ?? false;
}

export const ACTIVE_STATUSES: BookingStatus[] = ["assigned", "en_route", "on_site", "in_progress"];
export const OPEN_STATUSES: BookingStatus[] = ["requested", "confirmed", ...ACTIVE_STATUSES];

/** A crane has been dispatched once the booking reaches en_route. */
export function isDispatched(status: BookingStatus): boolean {
  return ["en_route", "on_site", "in_progress"].includes(status);
}
