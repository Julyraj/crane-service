import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  kind: "site" | "crane" | "yard";
  label?: string;
}

interface Props {
  markers: MapMarker[];
  onPick?: (lat: number, lng: number) => void;
  center?: { lat: number; lng: number };
  height?: number;
  fit?: boolean;
}

const icon = (kind: MapMarker["kind"]) =>
  L.divIcon({
    className: `map-pin map-pin--${kind}`,
    html: kind === "crane" ? "🏗️" : kind === "yard" ? "🏠" : "📍",
    iconSize: [34, 34],
    iconAnchor: [17, kind === "site" ? 32 : 17],
  });

export function MapView({ markers, onPick, center, height = 280, fit = true }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    if (!el.current || map.current) return;
    const c = center ?? markers[0] ?? { lat: 11.6643, lng: 78.146 };
    const m = L.map(el.current, { zoomControl: true, attributionControl: true, zoomAnimation: false, fadeAnimation: false, markerZoomAnimation: false }).setView([c.lat, c.lng], 11);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(m);
    m.on("click", (e: L.LeafletMouseEvent) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    const ro = new ResizeObserver(() => {
      if (map.current === m) m.invalidateSize({ animate: false });
    });
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      m.off();
      m.stop();
      m.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const m = map.current;
    const g = layer.current;
    if (!m || !g) return;
    g.clearLayers();
    for (const mk of markers) {
      const marker = L.marker([mk.lat, mk.lng], { icon: icon(mk.kind), title: mk.label });
      if (mk.label) marker.bindTooltip(mk.label);
      marker.addTo(g);
    }
    if (fit && markers.length > 1) {
      m.fitBounds(L.latLngBounds(markers.map((x) => [x.lat, x.lng] as [number, number])), { padding: [40, 40], maxZoom: 14, animate: false });
    } else if (markers.length === 1) {
      m.setView([markers[0]!.lat, markers[0]!.lng], Math.max(m.getZoom(), 13), { animate: false });
    }
  }, [markers, fit]);

  return <div ref={el} className="map" style={{ height }} role="application" aria-label="Map" />;
}
