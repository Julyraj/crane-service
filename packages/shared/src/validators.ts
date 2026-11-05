import { z } from "zod";
import { CRANE_CLASSES } from "./cranes.ts";

const craneClassIds = CRANE_CLASSES.map((c) => c.id) as [string, ...string[]];

export const phoneSchema = z
  .string()
  .trim()
  .transform((s) => s.replace(/[\s-]/g, "").replace(/^(\+91|91|0)(?=\d{10}$)/, ""))
  .pipe(z.string().regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number"));

export const requestOtpSchema = z.object({ phone: phoneSchema });

export const verifyOtpSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(/^\d{6}$/, "OTP must be 6 digits"),
  name: z.string().trim().min(1).max(80).optional(),
});

export const pinSchema = z.string().regex(/^\d{6}$/, "PIN must be exactly 6 digits");

export const pinStatusSchema = z.object({ phone: phoneSchema });

export const pinLoginSchema = z.object({
  phone: phoneSchema,
  pin: pinSchema,
  name: z.string().trim().min(1).max(80).optional(),
});

export const changePinSchema = z.object({
  currentPin: pinSchema.optional(),
  newPin: pinSchema,
});

export const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  company: z.string().trim().max(120).optional(),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^$|^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, "Invalid GSTIN")
    .optional(),
});

const lat = z.number().min(-90).max(90);
const lng = z.number().min(-180).max(180);

export const rentalTypeSchema = z.enum(["hourly", "daily", "monthly"]);

export const quoteRequestSchema = z.object({
  craneClassId: z.enum(craneClassIds),
  rentalType: rentalTypeSchema,
  duration: z.number().positive().max(1000),
  siteLat: lat,
  siteLng: lng,
  scheduledAt: z.iso.datetime({ offset: true }),
});

export const recommendSchema = z.object({
  loadTons: z.number().positive().max(500),
  liftHeightM: z.number().min(0).max(200).optional(),
  radiusM: z.number().min(0).max(100).optional(),
});

export const createBookingSchema = quoteRequestSchema.extend({
  siteAddress: z.string().trim().min(5).max(300),
  contactName: z.string().trim().min(1).max(80),
  contactPhone: phoneSchema,
  loadTons: z.number().positive().max(500).optional(),
  liftHeightM: z.number().min(0).max(200).optional(),
  radiusM: z.number().min(0).max(100).optional(),
  notes: z.string().trim().max(1000).optional(),
  paymentMethod: z.enum(["cash", "upi", "bank_transfer", "credit"]).default("upi"),
});

export const confirmBookingSchema = z.object({
  /** Optional negotiated total (incl. GST) that replaces the computed quote. */
  overrideTotal: z.number().positive().max(100_000_000).optional(),
  note: z.string().trim().max(500).optional(),
});

export const assignBookingSchema = z.object({
  craneId: z.string().min(1),
  operatorId: z.string().min(1),
});

export const operatorStatusSchema = z.object({
  status: z.enum(["en_route", "on_site"]),
});

export const startJobSchema = z.object({ otp: z.string().regex(/^\d{4}$/) });

export const completeJobSchema = z.object({
  actualDuration: z.number().positive().max(1000),
  note: z.string().trim().max(500).optional(),
});

export const cancelBookingSchema = z.object({ reason: z.string().trim().min(2).max(300) });

export const locationSchema = z.object({
  lat,
  lng,
  heading: z.number().min(0).max(360).optional(),
  speedKmh: z.number().min(0).max(200).optional(),
});

export const rateSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(500).optional(),
});

export const paymentSchema = z.object({
  status: z.enum(["unpaid", "advance_paid", "paid"]),
  method: z.enum(["cash", "upi", "bank_transfer", "credit"]).optional(),
  reference: z.string().trim().max(100).optional(),
});

const REG_NO = /^([A-Z]{2})\s*(\d{1,2})\s*([A-Z]{0,3})\s*(\d{1,4})$/;

/** Indian vehicle registration, normalised to "TN 30 AB 1234" so duplicates are caught. */
export const regNoSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(REG_NO, "Use a vehicle number like TN 30 AB 1234")
  .transform((s) => s.match(REG_NO)!.slice(1).filter(Boolean).join(" "));

const craneFields = {
  classId: z.enum(craneClassIds),
  regNo: regNoSchema,
  name: z.string().trim().min(1).max(80),
  defaultOperatorId: z.string().nullable().optional(),
};

export const craneUpsertSchema = z.object({
  ...craneFields,
  status: z.enum(["available", "maintenance"]).default("available"),
});

/**
 * PATCH body: every field optional and no defaults. (In zod 4, `.partial()` keeps
 * `.default()` values, which would silently reset the crane status on every edit.)
 */
export const craneUpdateSchema = z.object({
  classId: craneFields.classId.optional(),
  regNo: craneFields.regNo.optional(),
  name: craneFields.name.optional(),
  defaultOperatorId: craneFields.defaultOperatorId,
  status: z.enum(["available", "maintenance"]).optional(),
});

export const upsertUserSchema = z.object({
  phone: phoneSchema,
  name: z.string().trim().min(1).max(80),
  role: z.enum(["customer", "operator", "admin"]),
  /** Optional: set or reset this user's sign-in PIN (PIN mode). */
  pin: pinSchema.optional(),
});

const ratesSchema = z.object({
  hourly: z.number().nonnegative(),
  daily: z.number().nonnegative(),
  monthly: z.number().nonnegative(),
  minHours: z.number().int().min(1).max(24),
  perKm: z.number().nonnegative(),
});

export const pricingConfigSchema = z.object({
  rates: z.record(z.enum(craneClassIds), ratesSchema),
  gstRate: z.number().min(0).max(0.5),
  freeKm: z.number().min(0).max(500),
  nightSurchargeRate: z.number().min(0).max(1),
  instantSurchargeRate: z.number().min(0).max(1),
  instantWindowHours: z.number().min(0).max(48),
  operatorBataPerDay: z.number().min(0),
  cancellationFee: z.number().min(0),
});

export type CreateBookingInput = z.infer<typeof createBookingSchema>;
export type QuoteRequest = z.infer<typeof quoteRequestSchema>;
