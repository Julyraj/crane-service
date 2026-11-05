/**
 * Crane catalog. Capacities and reach figures are indicative values for
 * planning; the operator always confirms against the manufacturer load chart
 * before lifting.
 */
export type CraneCategory = "hydra" | "telescopic";

export interface CraneClass {
  id: string;
  name: string;
  category: CraneCategory;
  capacityTons: number;
  /** Maximum hook height in metres (main boom, fully extended). */
  maxLiftHeightM: number;
  /** Maximum working radius in metres. */
  maxRadiusM: number;
  /** Radius (m) at which the rated capacity applies. */
  ratedRadiusM: number;
  description: string;
  idealFor: string[];
}

export interface CraneRates {
  hourly: number;
  daily: number;
  monthly: number;
  /** Minimum billable hours for hourly rentals. */
  minHours: number;
  /** Mobilisation charge per km (charged both ways, beyond free km). */
  perKm: number;
}

export const CRANE_CLASSES: CraneClass[] = [
  {
    id: "hydra-13",
    name: "Hydra 13 Ton",
    category: "hydra",
    capacityTons: 13,
    maxLiftHeightM: 15,
    maxRadiusM: 11,
    ratedRadiusM: 2.5,
    description: "Pick-and-carry hydraulic crane for quick site lifts and shifting.",
    idealFor: ["Machinery shifting", "Transformer placement", "Factory loading/unloading"],
  },
  {
    id: "hydra-15",
    name: "Hydra 15 Ton",
    category: "hydra",
    capacityTons: 15,
    maxLiftHeightM: 17,
    maxRadiusM: 12,
    ratedRadiusM: 2.5,
    description: "Versatile pick-and-carry crane with extra reach for construction sites.",
    idealFor: ["Steel erection", "Precast placement", "Generator installation"],
  },
  {
    id: "hydra-16",
    name: "Hydra 16 Ton",
    category: "hydra",
    capacityTons: 16,
    maxLiftHeightM: 18,
    maxRadiusM: 12,
    ratedRadiusM: 2.5,
    description: "Highest capacity pick-and-carry hydra in the fleet.",
    idealFor: ["Heavy machinery", "Boiler shifting", "Industrial maintenance"],
  },
  {
    id: "tele-60",
    name: "Telescopic 60 Ton",
    category: "telescopic",
    capacityTons: 60,
    maxLiftHeightM: 40,
    maxRadiusM: 34,
    ratedRadiusM: 3,
    description: "Truck-mounted telescopic mobile crane for high and heavy lifts.",
    idealFor: ["Tower erection", "Bridge girders", "Rooftop HVAC/DG lifts"],
  },
  {
    id: "tele-100",
    name: "Telescopic 100 Ton",
    category: "telescopic",
    capacityTons: 100,
    maxLiftHeightM: 50,
    maxRadiusM: 42,
    ratedRadiusM: 3,
    description: "All-terrain class mobile crane for major infrastructure lifts.",
    idealFor: ["Wind / telecom towers", "Heavy precast", "Plant installation"],
  },
  {
    id: "tele-150",
    name: "Telescopic 150 Ton",
    category: "telescopic",
    capacityTons: 150,
    maxLiftHeightM: 60,
    maxRadiusM: 50,
    ratedRadiusM: 3,
    description: "Largest crane in the fleet for the heaviest project cargo.",
    idealFor: ["Windmill components", "Refinery equipment", "Large bridge sections"],
  },
];

/**
 * Sample default rates in INR. Replace with real tariffs from Admin → Pricing;
 * the server stores the live values in its settings table.
 */
export const DEFAULT_RATES: Record<string, CraneRates> = {
  "hydra-13": { hourly: 1200, daily: 8500, monthly: 160000, minHours: 4, perKm: 60 },
  "hydra-15": { hourly: 1400, daily: 10000, monthly: 185000, minHours: 4, perKm: 65 },
  "hydra-16": { hourly: 1500, daily: 11000, monthly: 200000, minHours: 4, perKm: 70 },
  "tele-60": { hourly: 5500, daily: 40000, monthly: 750000, minHours: 8, perKm: 150 },
  "tele-100": { hourly: 8500, daily: 62000, monthly: 1150000, minHours: 8, perKm: 220 },
  "tele-150": { hourly: 12000, daily: 88000, monthly: 1650000, minHours: 8, perKm: 300 },
};

export function getCraneClass(id: string): CraneClass | undefined {
  return CRANE_CLASSES.find((c) => c.id === id);
}

/** Safe working load as a fraction of chart capacity. */
export const SAFE_LOAD_FACTOR = 0.75;

/**
 * Approximate capacity at a given radius. Real load charts are non-linear;
 * this inverse-radius model is deliberately conservative for planning.
 */
export function capacityAtRadius(crane: CraneClass, radiusM: number): number {
  if (radiusM > crane.maxRadiusM) return 0;
  const r = Math.max(radiusM, crane.ratedRadiusM);
  return crane.capacityTons * (crane.ratedRadiusM / r);
}

export interface LiftRequirement {
  loadTons: number;
  liftHeightM?: number;
  radiusM?: number;
}

export interface CraneRecommendation {
  craneClassId: string | null;
  reason: string;
  /** Utilisation of safe capacity at the requested radius (0..1+). */
  utilisation?: number;
  alternatives: string[];
}

export function recommendCrane(req: LiftRequirement): CraneRecommendation {
  const height = req.liftHeightM ?? 0;
  const radius = req.radiusM ?? 0;
  const qualifying = CRANE_CLASSES.filter((c) => {
    if (height > c.maxLiftHeightM) return false;
    if (radius > c.maxRadiusM) return false;
    const safe = capacityAtRadius(c, radius) * SAFE_LOAD_FACTOR;
    return safe >= req.loadTons;
  }).sort((a, b) => a.capacityTons - b.capacityTons);

  if (qualifying.length === 0) {
    return {
      craneClassId: null,
      reason:
        "No single crane in our fleet covers this lift safely. Call us for a site survey or a tandem-lift plan.",
      alternatives: [],
    };
  }
  const best = qualifying[0]!;
  const safe = capacityAtRadius(best, radius) * SAFE_LOAD_FACTOR;
  return {
    craneClassId: best.id,
    utilisation: req.loadTons / safe,
    reason: `${best.name} lifts ~${safe.toFixed(1)} t safely at ${Math.max(radius, best.ratedRadiusM)} m radius (75% of chart) and reaches ${best.maxLiftHeightM} m.`,
    alternatives: qualifying.slice(1, 3).map((c) => c.id),
  };
}
