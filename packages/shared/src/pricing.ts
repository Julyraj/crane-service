import { CRANE_CLASSES, DEFAULT_RATES, type CraneRates } from "./cranes.ts";

export type RentalType = "hourly" | "daily" | "monthly";

export interface PricingConfig {
  rates: Record<string, CraneRates>;
  gstRate: number;
  /** Kilometres of mobilisation included free (one way). */
  freeKm: number;
  /** Surcharge on rental charge when the job starts between 22:00 and 06:00 IST. */
  nightSurchargeRate: number;
  /** Surcharge when the crane is needed within `instantWindowHours`. */
  instantSurchargeRate: number;
  instantWindowHours: number;
  /** Operator food/stay allowance per day for daily and monthly rentals. */
  operatorBataPerDay: number;
  /** Flat fee if a customer cancels after a crane has been dispatched. */
  cancellationFee: number;
}

export const DEFAULT_PRICING: PricingConfig = {
  rates: DEFAULT_RATES,
  gstRate: 0.18,
  freeKm: 10,
  nightSurchargeRate: 0.15,
  instantSurchargeRate: 0.1,
  instantWindowHours: 2,
  operatorBataPerDay: 500,
  cancellationFee: 1500,
};

export interface QuoteInput {
  craneClassId: string;
  rentalType: RentalType;
  /** Hours for hourly, days for daily, months for monthly. */
  duration: number;
  /** One-way road distance from yard to site, km. */
  distanceKm: number;
  scheduledAt: string | Date;
  now?: string | Date;
}

export interface QuoteLine {
  code: string;
  label: string;
  amount: number;
}

export interface Quote {
  craneClassId: string;
  rentalType: RentalType;
  billableUnits: number;
  unitRate: number;
  lines: QuoteLine[];
  subtotal: number;
  /** GST rate used for this quote (kept so invoices never pick up later rate changes). */
  gstRate?: number;
  gst: number;
  total: number;
  notes: string[];
}

const IST_OFFSET_MIN = 330;

/** Time a booking occupies a crane and operator, in ms (daily = 24 h/day, monthly = 30 days). */
export function jobLengthMs(rentalType: RentalType, duration: number): number {
  const hour = 3_600_000;
  if (rentalType === "hourly") return Math.ceil(duration) * hour;
  if (rentalType === "daily") return Math.ceil(duration) * 24 * hour;
  return Math.ceil(duration) * 30 * 24 * hour;
}

/** Hour of day (0-23) in India Standard Time. */
export function istHour(d: Date): number {
  const minutes = d.getUTCHours() * 60 + d.getUTCMinutes() + IST_OFFSET_MIN;
  return Math.floor((((minutes % 1440) + 1440) % 1440) / 60);
}

const round = (n: number) => Math.round(n);

export function computeQuote(input: QuoteInput, config: PricingConfig = DEFAULT_PRICING): Quote {
  const crane = CRANE_CLASSES.find((c) => c.id === input.craneClassId);
  if (!crane) throw new Error(`Unknown crane class: ${input.craneClassId}`);
  const rates = config.rates[crane.id] ?? DEFAULT_RATES[crane.id]!;
  const scheduled = new Date(input.scheduledAt);
  const now = input.now ? new Date(input.now) : new Date();
  const lines: QuoteLine[] = [];
  const notes: string[] = [];

  let billableUnits: number;
  let unitRate: number;
  let unitLabel: string;
  let days = 0;
  switch (input.rentalType) {
    case "hourly":
      billableUnits = Math.max(Math.ceil(input.duration), rates.minHours);
      unitRate = rates.hourly;
      unitLabel = "hr";
      if (billableUnits > input.duration) notes.push(`Minimum billing is ${rates.minHours} hours.`);
      break;
    case "daily":
      billableUnits = Math.max(1, Math.ceil(input.duration));
      unitRate = rates.daily;
      unitLabel = "day";
      days = billableUnits;
      notes.push("Daily rental covers one 8-hour shift per day; extra hours billed at the hourly rate.");
      break;
    case "monthly":
      billableUnits = Math.max(1, Math.ceil(input.duration));
      unitRate = rates.monthly;
      unitLabel = "month";
      days = billableUnits * 26;
      notes.push("Monthly rental: 26 working days × 8 hours, fuel by customer unless agreed otherwise.");
      break;
  }

  const rental = billableUnits * unitRate;
  lines.push({
    code: "rental",
    label: `${crane.name} — ${billableUnits} ${unitLabel}${billableUnits > 1 ? "s" : ""} × ₹${unitRate.toLocaleString("en-IN")}`,
    amount: rental,
  });

  const chargeableKm = Math.max(0, Math.ceil(input.distanceKm) - config.freeKm);
  if (chargeableKm > 0) {
    lines.push({
      code: "mobilisation",
      label: `Mobilisation ${chargeableKm} km × 2 ways × ₹${rates.perKm}`,
      amount: chargeableKm * 2 * rates.perKm,
    });
  } else {
    notes.push(`First ${config.freeKm} km of travel is free.`);
  }

  if (input.rentalType === "hourly") {
    const h = istHour(scheduled);
    if (h >= 22 || h < 6) {
      lines.push({
        code: "night",
        label: `Night shift surcharge (${Math.round(config.nightSurchargeRate * 100)}%)`,
        amount: round(rental * config.nightSurchargeRate),
      });
    }
  }

  const leadHours = (scheduled.getTime() - now.getTime()) / 3_600_000;
  if (leadHours < config.instantWindowHours && config.instantSurchargeRate > 0) {
    lines.push({
      code: "instant",
      label: `Instant dispatch (within ${config.instantWindowHours} h, ${Math.round(config.instantSurchargeRate * 100)}%)`,
      amount: round(rental * config.instantSurchargeRate),
    });
  }

  if (days > 0 && config.operatorBataPerDay > 0) {
    lines.push({
      code: "bata",
      label: `Operator bata ${days} days × ₹${config.operatorBataPerDay}`,
      amount: days * config.operatorBataPerDay,
    });
  }

  const subtotal = lines.reduce((s, l) => s + l.amount, 0);
  const gst = round(subtotal * config.gstRate);
  return {
    craneClassId: crane.id,
    rentalType: input.rentalType,
    billableUnits,
    unitRate,
    lines,
    subtotal,
    gstRate: config.gstRate,
    gst,
    total: subtotal + gst,
    notes,
  };
}
