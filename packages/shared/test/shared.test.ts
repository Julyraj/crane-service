import { describe, expect, it } from "vitest";
import {
  canTransition,
  computeQuote,
  createBookingSchema,
  DEFAULT_PRICING,
  estimateRoadKm,
  istHour,
  phoneSchema,
  recommendCrane,
} from "../src/index.ts";

const day = "2026-11-10T04:30:00.000Z"; // 10:00 IST
const now = "2026-11-05T04:30:00.000Z";

describe("computeQuote", () => {
  it("applies minimum hours and free km", () => {
    const q = computeQuote({ craneClassId: "hydra-13", rentalType: "hourly", duration: 2, distanceKm: 8, scheduledAt: day, now });
    expect(q.billableUnits).toBe(4);
    expect(q.subtotal).toBe(4 * 1200);
    expect(q.gst).toBe(Math.round(4800 * 0.18));
    expect(q.total).toBe(4800 + 864);
    expect(q.lines.map((l) => l.code)).toEqual(["rental"]);
  });

  it("charges mobilisation both ways beyond free km", () => {
    const q = computeQuote({ craneClassId: "tele-60", rentalType: "hourly", duration: 10, distanceKm: 30.2, scheduledAt: day, now });
    const mob = q.lines.find((l) => l.code === "mobilisation")!;
    expect(mob.amount).toBe((31 - 10) * 2 * 150);
  });

  it("adds night and instant surcharges", () => {
    const night = "2026-11-05T17:00:00.000Z"; // 22:30 IST
    const q = computeQuote({ craneClassId: "hydra-15", rentalType: "hourly", duration: 4, distanceKm: 5, scheduledAt: night, now: "2026-11-05T16:30:00.000Z" });
    const codes = q.lines.map((l) => l.code);
    expect(codes).toContain("night");
    expect(codes).toContain("instant");
    expect(q.lines.find((l) => l.code === "night")!.amount).toBe(Math.round(5600 * 0.15));
  });

  it("adds operator bata for daily rentals", () => {
    const q = computeQuote({ craneClassId: "hydra-16", rentalType: "daily", duration: 3, distanceKm: 0, scheduledAt: day, now });
    expect(q.lines.find((l) => l.code === "bata")!.amount).toBe(3 * DEFAULT_PRICING.operatorBataPerDay);
  });

  it("rejects unknown cranes", () => {
    expect(() => computeQuote({ craneClassId: "x", rentalType: "hourly", duration: 1, distanceKm: 0, scheduledAt: day })).toThrow();
  });
});

describe("recommendCrane", () => {
  it("picks the smallest hydra for light close lifts", () => {
    expect(recommendCrane({ loadTons: 5, radiusM: 3 }).craneClassId).toBe("hydra-13");
  });
  it("moves to telescopic for height", () => {
    expect(recommendCrane({ loadTons: 3, liftHeightM: 30 }).craneClassId).toBe("tele-60");
  });
  it("accounts for radius derating", () => {
    // 20 t at 8 m: 60 t crane gives 22.5 t chart → 16.9 t safe (too low); 100 t gives 28.1 t safe
    const r = recommendCrane({ loadTons: 20, radiusM: 8 });
    expect(r.craneClassId).toBe("tele-100");
  });
  it("returns null when nothing fits", () => {
    expect(recommendCrane({ loadTons: 400 }).craneClassId).toBeNull();
  });
});

describe("status machine", () => {
  it("enforces role permissions", () => {
    expect(canTransition("requested", "confirmed", "admin")).toBe(true);
    expect(canTransition("requested", "confirmed", "customer")).toBe(false);
    expect(canTransition("on_site", "in_progress", "operator")).toBe(true);
    expect(canTransition("en_route", "cancelled", "customer")).toBe(false);
    expect(canTransition("completed", "cancelled", "admin")).toBe(false);
  });
});

describe("helpers", () => {
  it("normalises Indian phone numbers", () => {
    expect(phoneSchema.parse("+91 97894 73129")).toBe("9789473129");
    expect(phoneSchema.safeParse("12345").success).toBe(false);
  });
  it("computes IST hour", () => {
    expect(istHour(new Date("2026-11-05T18:30:00Z"))).toBe(0);
  });
  it("estimates road distance Salem → Erode", () => {
    const km = estimateRoadKm({ lat: 11.6643, lng: 78.146 }, { lat: 11.341, lng: 77.7172 });
    expect(km).toBeGreaterThan(60);
    expect(km).toBeLessThan(90);
  });
  it("validates booking payloads", () => {
    const r = createBookingSchema.safeParse({
      craneClassId: "hydra-13", rentalType: "hourly", duration: 4, siteLat: 11.6, siteLng: 78.1,
      scheduledAt: day, siteAddress: "Steel Plant Road, Salem", contactName: "Kumar", contactPhone: "9876543210",
    });
    expect(r.success).toBe(true);
  });
});
