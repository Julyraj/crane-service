import { DEFAULT_PRICING, pricingConfigSchema, type PricingConfig } from "@crane/shared";
import type { Db } from "../db.ts";

export function getPricing(db: Db): PricingConfig {
  const row = db.prepare("SELECT value FROM settings WHERE key = 'pricing'").get() as { value: string } | undefined;
  if (!row) return DEFAULT_PRICING;
  const parsed = pricingConfigSchema.safeParse(JSON.parse(row.value));
  if (!parsed.success) return DEFAULT_PRICING;
  return { ...DEFAULT_PRICING, ...parsed.data, rates: { ...DEFAULT_PRICING.rates, ...parsed.data.rates } };
}

export function setPricing(db: Db, pricing: PricingConfig) {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES ('pricing', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(JSON.stringify(pricing));
}
