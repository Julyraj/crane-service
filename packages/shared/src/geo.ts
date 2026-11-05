export interface LatLng {
  lat: number;
  lng: number;
}

/** Salem, Tamil Nadu — default yard location. */
export const DEFAULT_YARD: LatLng = { lat: 11.6643, lng: 78.146 };

/** Straight-line → road distance multiplier for Indian road networks. */
export const ROAD_FACTOR = 1.3;

export function haversineKm(a: LatLng, b: LatLng): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function estimateRoadKm(a: LatLng, b: LatLng): number {
  return Math.round(haversineKm(a, b) * ROAD_FACTOR * 10) / 10;
}

export function googleMapsDirectionsUrl(to: LatLng, from?: LatLng): string {
  const params = new URLSearchParams({ api: "1", destination: `${to.lat},${to.lng}`, travelmode: "driving" });
  if (from) params.set("origin", `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}
