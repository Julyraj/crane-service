import { z } from "zod";
import { DEFAULT_PRICING, pricingConfigSchema, type PricingConfig } from "@crane/shared";
import type { Db } from "../db.ts";

/**
 * Stored pricing is merged field by field over the defaults, so a crane class added
 * later (or one bad field) never throws away the rest of the admin's saved prices.
 */
const storedSchema = pricingConfigSchema
  .omit({ rates: true })
  .partial()
  .extend({ rates: z.record(z.string(), z.unknown()).optional() });

const rateSchema = pricingConfigSchema.shape.rates.valueType;

export function getPricing(db: Db): PricingConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'pricing'").get() as { value: string } | undefined;
  if (!row) return DEFAULT_PRICING;
  let raw: unknown;
  try {
    raw = JSON.parse(row.value);
  } catch {
    return DEFAULT_PRICING;
  }
  const parsed = storedSchema.safeParse(raw);
  if (!parsed.success) return DEFAULT_PRICING;
  const { rates: storedRates, ...rest } = parsed.data;
  const rates = { ...DEFAULT_PRICING.rates };
  for (const [id, value] of Object.entries(storedRates ?? {})) {
    if (!(id in rates)) continue;
    const r = rateSchema.safeParse(value);
    if (r.success) rates[id] = r.data;
  }
  const clean = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined));
  return { ...DEFAULT_PRICING, ...clean, rates };
}

export function setPricing(db: Db, pricing: PricingConfig) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('pricing', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(pricing));
}
