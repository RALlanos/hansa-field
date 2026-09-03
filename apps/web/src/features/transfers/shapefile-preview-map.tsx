"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef } from "react";
import type { FeatureCollection, Point } from "geojson";
import type { GeoJSON, Map as LeafletMap } from "leaflet";

export function ShapefilePreviewMap({
  collection,
}: {
  collection: FeatureCollection<Point>;
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<GeoJSON | null>(null);

  useEffect(() => {
    if (!container.current || map.current) return;
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !container.current) return;
      const instance = leaflet
        .map(container.current)
        .setView([-17.75, -63.18], 12);
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(instance);
      layer.current = leaflet
        .geoJSON(collection, {
          pointToLayer: (_feature, latlng) =>
            leaflet.circleMarker(latlng, {
              radius: 4,
              color: "#ffffff",
              weight: 1,
              fillColor: "#2563eb",
              fillOpacity: 0.85,
            }),
        })
        .addTo(instance);
      if (collection.features.length) {
        instance.fitBounds(layer.current.getBounds(), { padding: [20, 20] });
      }
      map.current = instance;
      window.setTimeout(() => instance.invalidateSize(), 0);
    });
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, [collection]);

  return <div className="shapefile-preview-map" ref={container} />;
}
