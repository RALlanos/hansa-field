"use client";

import "leaflet/dist/leaflet.css";

import { useEffect, useRef, useState } from "react";
import type {
  CircleMarker,
  GeoJSON,
  LeafletMouseEvent,
  Map as LeafletMap,
} from "leaflet";
import type { FeatureCollection } from "geojson";

export type RecordGeometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] };
export type MapRecord = {
  id: string;
  attributes: Record<string, unknown>;
  geometry: RecordGeometry | null;
  updatedAt: string;
};

type Props = {
  appId: string;
  color: string;
  records: MapRecord[];
  pickedPoint: [number, number] | null;
  picking: boolean;
  onPick: (coordinates: [number, number]) => void;
  onRecords: (records: MapRecord[]) => void;
  onSelect: (record: MapRecord) => void;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

export function RecordsMap({
  appId,
  color,
  records,
  pickedPoint,
  picking,
  onPick,
  onRecords,
  onSelect,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<GeoJSON | null>(null);
  const recordsRef = useRef(records);
  const fitted = useRef(false);
  const pickedMarker = useRef<CircleMarker | null>(null);
  const pickingRef = useRef(picking);
  const onPickRef = useRef(onPick);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    recordsRef.current = records;
  }, [records]);

  useEffect(() => {
    pickingRef.current = picking;
    onPickRef.current = onPick;
  }, [onPick, picking]);

  useEffect(() => {
    if (!container.current || map.current) return;
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !container.current) return;
      const instance = leaflet
        .map(container.current, { zoomControl: true })
        .setView([-16.5, -68.15], 12);
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          maxZoom: 19,
        })
        .addTo(instance);
      const loadVisible = async () => {
        const bounds = instance.getBounds();
        const bbox = [
          bounds.getWest(),
          bounds.getSouth(),
          bounds.getEast(),
          bounds.getNorth(),
        ].join(",");
        try {
          const response = await fetch(
            `${apiUrl}/api/apps/${appId}/records?bbox=${encodeURIComponent(bbox)}&limit=1000`,
          );
          if (!response.ok) return;
          const body = (await response.json()) as { data: MapRecord[] };
          onRecords(body.data);
        } catch {
          // The surrounding records view keeps the last successful data visible.
        }
      };
      instance.on("moveend", loadVisible);
      instance.on("click", (event: LeafletMouseEvent) => {
        if (pickingRef.current) {
          onPickRef.current([event.latlng.lng, event.latlng.lat]);
        }
      });
      map.current = instance;
      setInitialized(true);
      window.setTimeout(() => instance.invalidateSize(), 0);
    });
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
      layer.current = null;
    };
  }, [appId, onRecords]);

  useEffect(() => {
    if (!map.current) return;
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !map.current) return;
      layer.current?.remove();
      const features = records
        .filter((record) => record.geometry)
        .map((record) => ({
          type: "Feature" as const,
          id: record.id,
          geometry: record.geometry!,
          properties: {},
        }));
      const collection: FeatureCollection = {
        type: "FeatureCollection",
        features,
      };
      const nextLayer = leaflet
        .geoJSON(collection, {
          pointToLayer: (_feature, latlng) =>
            leaflet.circleMarker(latlng, {
              radius: 6,
              color: "#ffffff",
              weight: 2,
              fillColor: color,
              fillOpacity: 0.95,
            }),
          style: { color, weight: 3, fillOpacity: 0.2 },
          onEachFeature: (feature, featureLayer) => {
            const record = recordsRef.current.find(
              (item) => item.id === feature.id,
            );
            if (record) featureLayer.on("click", () => onSelect(record));
          },
        })
        .addTo(map.current);
      layer.current = nextLayer;
      if (!fitted.current && features.length) {
        map.current.fitBounds(nextLayer.getBounds(), {
          padding: [30, 30],
          maxZoom: 16,
        });
        fitted.current = true;
      }
    });
    return () => {
      active = false;
    };
  }, [color, initialized, onSelect, records]);

  useEffect(() => {
    if (!map.current || !initialized) return;
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !map.current) return;
      pickedMarker.current?.remove();
      pickedMarker.current = null;
      if (!pickedPoint) return;
      pickedMarker.current = leaflet
        .circleMarker([pickedPoint[1], pickedPoint[0]], {
          radius: 9,
          color: "#ffffff",
          weight: 3,
          fillColor: color,
          fillOpacity: 1,
        })
        .bindTooltip("Ubicación seleccionada")
        .addTo(map.current);
    });
    return () => {
      active = false;
    };
  }, [color, initialized, pickedPoint]);

  return (
    <div
      className={`leaflet-records-map ${picking ? "is-picking" : ""}`}
      ref={container}
    />
  );
}
