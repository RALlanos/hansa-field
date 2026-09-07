"use client";

import "leaflet/dist/leaflet.css";

import type { FeatureCollection, Geometry } from "geojson";
import type { GeoJSON, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";

import {
  mapIconMarkerHtml,
  mapLineDashArray,
  normalizeMapColor,
} from "../apps/map-symbols";
import { buildMapRecordsUrl, type MapBounds } from "./multi-app-map-model";

type MapFeature = Readonly<{
  id: string;
  appId: string;
  appName: string;
  mapIcon: string;
  mapColor: string;
  count: number;
  geometry: Geometry;
  projectName?: string;
  recordUuid?: string;
  projectRecordUuid?: string;
  projectAppId?: string;
  projectId?: string;
  isCluster?: boolean;
}>;

type MapResponse = Readonly<{
  data: MapFeature[];
  clustered: boolean;
  totalRecords: number;
  truncated: boolean;
}>;

export type MultiAppMapStatus = Readonly<{
  visibleFeatures: number;
  totalRecords: number;
  clustered: boolean;
  truncated: boolean;
}>;

type Props = Readonly<{
  appIds: readonly string[];
  onStatus: (status: MultiAppMapStatus) => void;
  projectId?: string;
  endpoint?: string;
  search?: string;
  onViewportChange?: (bounds: MapBounds) => void;
}>;

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
const emptyStatus: MultiAppMapStatus = {
  visibleFeatures: 0,
  totalRecords: 0,
  clustered: true,
  truncated: false,
};

function clusterMarkerHtml(feature: MapFeature): string {
  const color = normalizeMapColor(feature.mapColor);
  return `<span class="multi-map-cluster" style="--cluster-color:${color}"><b>${feature.count}</b></span>`;
}

export function MultiAppMap({
  appIds,
  onStatus,
  projectId,
  endpoint,
  search = "",
  onViewportChange,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<GeoJSON | null>(null);
  const cache = useRef(new Map<string, MapResponse>());
  const fitted = useRef(false);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const appIdsKey = appIds.join(",");

  useEffect(() => {
    if (!container.current || map.current) return;
    let active = true;
    void import("leaflet").then((leaflet) => {
      if (!active || !container.current) return;
      const instance = leaflet
        .map(container.current, {
          maxZoom: 22,
          preferCanvas: true,
          zoomControl: true,
        })
        .setView([-16.7, -64.5], 5);
      leaflet
        .tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap contributors",
          keepBuffer: 4,
          maxNativeZoom: 19,
          maxZoom: 22,
          updateWhenIdle: true,
        })
        .addTo(instance);
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
  }, []);

  useEffect(() => {
    const instance = map.current;
    if (!initialized || !instance) return;
    const selectedAppIds = appIdsKey ? appIdsKey.split(",") : [];
    let controller: AbortController | null = null;
    let active = true;

    const render = async (response: MapResponse) => {
      const leaflet = await import("leaflet");
      if (!active || !map.current) return;
      const collection: FeatureCollection<Geometry, MapFeature> = {
        type: "FeatureCollection",
        features: response.data.map((feature) => ({
          type: "Feature",
          id: feature.id,
          geometry: feature.geometry,
          properties: feature,
        })),
      };
      const nextLayer = leaflet.geoJSON(collection, {
        pointToLayer: (feature, latlng) => {
          const properties = feature.properties;
          return leaflet.marker(latlng, {
            icon: leaflet.divIcon({
              className:
                properties.count > 1
                  ? "multi-map-cluster-icon"
                  : "record-map-div-icon",
              html:
                properties.count > 1
                  ? clusterMarkerHtml(properties)
                  : mapIconMarkerHtml(properties.mapIcon, properties.mapColor),
              iconAnchor: properties.count > 1 ? [16, 16] : [11, 11],
              iconSize: properties.count > 1 ? [32, 32] : [22, 22],
            }),
          });
        },
        style: (feature) => ({
          color: normalizeMapColor(feature?.properties.mapColor ?? ""),
          dashArray: mapLineDashArray(feature?.properties.mapIcon ?? "pin"),
          fillOpacity: 0.18,
          weight: 3,
        }),
        onEachFeature: (feature, featureLayer) => {
          const tooltip = document.createElement("span");
          tooltip.textContent = `${feature.properties.projectName ? feature.properties.projectName + " · " : ""}${feature.properties.appName}: ${feature.properties.recordUuid ?? feature.properties.count.toLocaleString("es-BO")}`;
          featureLayer.bindTooltip(tooltip);
          if (feature.properties.isCluster)
            featureLayer.on("click", () => {
              if (feature.geometry.type === "Point") {
                const [longitude, latitude] = feature.geometry.coordinates;
                if (longitude !== undefined && latitude !== undefined)
                  instance.setView(
                    [latitude, longitude],
                    Math.min(22, instance.getZoom() + 2),
                  );
              }
            });
        },
      });
      layer.current?.remove();
      nextLayer.addTo(map.current);
      layer.current = nextLayer;
      if (!fitted.current && response.data.length) {
        const bounds = nextLayer.getBounds();
        if (bounds.isValid()) {
          fitted.current = true;
          map.current.fitBounds(bounds, { maxZoom: 12, padding: [24, 24] });
        }
      }
      onStatus({
        visibleFeatures: response.data.length,
        totalRecords: response.totalRecords,
        clustered: response.clustered,
        truncated: response.truncated,
      });
    };

    const loadVisible = async () => {
      controller?.abort();
      if (!selectedAppIds.length) {
        layer.current?.remove();
        layer.current = null;
        onStatus(emptyStatus);
        setLoading(false);
        setError("");
        return;
      }
      const bounds = instance.getBounds();
      const viewport: MapBounds = [
        Number(bounds.getWest().toFixed(5)),
        Number(bounds.getSouth().toFixed(5)),
        Number(bounds.getEast().toFixed(5)),
        Number(bounds.getNorth().toFixed(5)),
      ];
      onViewportChange?.(viewport);
      let url = buildMapRecordsUrl(
        apiUrl,
        viewport,
        instance.getZoom(),
        selectedAppIds,
        projectId,
      );
      if (endpoint) {
        const parameters = new URL(url).searchParams;
        parameters.set("search", search);
        url = `${endpoint}?${parameters.toString()}`;
      }
      const cached = cache.current.get(url);
      if (cached) {
        await render(cached);
        setLoading(false);
        setError("");
        return;
      }
      controller = new AbortController();
      setLoading(true);
      try {
        const result = await fetch(url, { signal: controller.signal });
        if (!result.ok) throw new Error("No se pudo consultar el mapa.");
        const response = (await result.json()) as MapResponse;
        if (cache.current.size >= 12) {
          const oldestKey = cache.current.keys().next().value;
          if (oldestKey) cache.current.delete(oldestKey);
        }
        cache.current.set(url, response);
        await render(response);
        setError("");
      } catch (reason: unknown) {
        if (reason instanceof DOMException && reason.name === "AbortError")
          return;
        setError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar el mapa.",
        );
      } finally {
        if (active) setLoading(false);
      }
    };

    instance.on("moveend", loadVisible);
    void loadVisible();
    return () => {
      active = false;
      controller?.abort();
      instance.off("moveend", loadVisible);
    };
  }, [
    appIdsKey,
    initialized,
    onStatus,
    onViewportChange,
    projectId,
    endpoint,
    search,
  ]);

  return (
    <div className="multi-app-map-frame">
      <div className="multi-app-map" ref={container} />
      {loading && <output className="multi-map-state">Cargando mapa…</output>}
      {error && (
        <p className="multi-map-state is-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
