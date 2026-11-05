import type { BookingStatus, Role } from "./booking-status.ts";
import type { Quote, RentalType, PricingConfig } from "./pricing.ts";
import type { CraneClass, CraneRates } from "./cranes.ts";

export interface User {
  id: string;
  phone: string;
  name: string | null;
  role: Role;
  company: string | null;
  gstin: string | null;
  createdAt: string;
}

export type CraneStatus = "available" | "on_job" | "maintenance";

export interface Crane {
  id: string;
  classId: string;
  regNo: string;
  name: string;
  status: CraneStatus;
  defaultOperatorId: string | null;
  lastLat: number | null;
  lastLng: number | null;
  lastSeenAt: string | null;
}

export type PaymentStatus = "unpaid" | "advance_paid" | "paid";
export type PaymentMethod = "cash" | "upi" | "bank_transfer" | "credit";

export interface BookingEvent {
  id: string;
  status: BookingStatus | "note" | "payment" | "rating";
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

export interface Booking {
  id: string;
  code: string;
  status: BookingStatus;
  customerId: string;
  customerName: string | null;
  customerPhone: string;
  craneClassId: string;
  rentalType: RentalType;
  duration: number;
  actualDuration: number | null;
  scheduledAt: string;
  siteAddress: string;
  siteLat: number;
  siteLng: number;
  distanceKm: number;
  loadTons: number | null;
  liftHeightM: number | null;
  radiusM: number | null;
  notes: string | null;
  contactName: string;
  contactPhone: string;
  quote: Quote;
  finalQuote: Quote | null;
  overrideTotal: number | null;
  amountDue: number;
  craneId: string | null;
  craneRegNo: string | null;
  craneName: string | null;
  operatorId: string | null;
  operatorName: string | null;
  operatorPhone: string | null;
  /** Only present for the booking's customer and admins. */
  startOtp?: string | null;
  operatorLat: number | null;
  operatorLng: number | null;
  operatorSeenAt: string | null;
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  paymentReference: string | null;
  cancelReason: string | null;
  customerRating: number | null;
  operatorRating: number | null;
  createdAt: string;
  updatedAt: string;
  events?: BookingEvent[];
}

export interface BusinessInfo {
  name: string;
  phone: string;
  upiId: string | null;
  gstin: string | null;
  sac: string;
  address: string;
  yard: { lat: number; lng: number };
}

export interface CatalogResponse {
  business: BusinessInfo;
  classes: (CraneClass & { rates: CraneRates; availableUnits: number })[];
  pricing: Omit<PricingConfig, "rates">;
}

export interface AdminStats {
  bookingsToday: number;
  openRequests: number;
  activeJobs: number;
  completedThisMonth: number;
  revenueThisMonth: number;
  outstanding: number;
  fleet: { total: number; available: number; onJob: number; maintenance: number };
  averageRating: number | null;
}
