"use client";
import { getApiBase } from "../../lib/api-base";
import { cacheKeys, localDataCache } from "../../lib/local-data-cache";
import {
  synchronizeWorkspaceScope,
  workspaceScopeKey,
} from "../../lib/incremental-workspace-sync";

import "leaflet/dist/leaflet.css";

import type { FeatureCollection, Geometry } from "geojson";
import type { GeoJSON, Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState } from "react";

import {
  mapIconMarkerHtml,
  mapLineDashArray,
  normalizeMapColor,
} from "../apps/map-symbols";
import {
  buildMapRecordsUrl,
  type MapBounds,
  type MapMode,
} from "./multi-app-map-model";

export type MapFeature = Readonly<{
  id: string;
  recordUuid: string | null;
  datasetId: string;
  appId: string | null;
  projectId: string | null;
  projectAppId: string | null;
  projectRecordUuid: string | null;
  contextRef: string | null;
  revision: number;
  geometry: Geometry;
  symbol: { icon: string; color: string; label?: string };
  count: number;
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
  mode?: MapMode;
  appIds: readonly string[];
  projectIds?: readonly string[];
  localCollectionIds?: readonly string[];
  onStatus: (status: MultiAppMapStatus) => void;
  onViewportChange?: (bounds: MapBounds) => void;
  onSelect?: (feature: MapFeature) => void;
  refresh?: number;
}>;

const emptyStatus: MultiAppMapStatus = {
  visibleFeatures: 0,
  totalRecords: 0,
  clustered: true,
  truncated: false,
};

function clusterMarkerHtml(feature: MapFeature): string {
  const color = normalizeMapColor(feature.symbol.color);
  return `<span class="multi-map-cluster" style="--cluster-color:${color}"><b>${feature.count}</b></span>`;
}

export function MultiAppMap({
  mode = "app",
  appIds,
  projectIds = [],
  localCollectionIds = [],
  onStatus,
  onViewportChange,
  onSelect,
  refresh = 0,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<GeoJSON | null>(null);
  const fitted = useRef(false);
  const selection = useRef(onSelect);
  selection.current = onSelect;
  useEffect(() => {
    void localDataCache.invalidateCategory("map");
  }, [refresh]);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const appIdsKey = appIds.join(",");
  const projectIdsKey = projectIds.join(",");
  const localCollectionIdsKey = localCollectionIds.join(",");

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
    const selectedProjectIds = projectIdsKey ? projectIdsKey.split(",") : [];
    const selectedLocalCollectionIds = localCollectionIdsKey
      ? localCollectionIdsKey.split(",")
      : [];
    let controller: AbortController | null = null;
    let timer: number | null = null;
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
                  : mapIconMarkerHtml(
                      properties.symbol.icon,
                      properties.symbol.color,
                    ),
              iconAnchor: properties.count > 1 ? [16, 16] : [11, 11],
              iconSize: properties.count > 1 ? [32, 32] : [22, 22],
            }),
          });
        },
        style: (feature) => ({
          color: normalizeMapColor(feature?.properties.symbol.color ?? ""),
          dashArray: mapLineDashArray(feature?.properties.symbol.icon ?? "pin"),
          fillOpacity: 0.18,
          weight: 3,
        }),
        onEachFeature: (feature, featureLayer) => {
          const tooltip = document.createElement("span");
          tooltip.textContent = `${feature.properties.symbol.label ?? "Registro"}: ${feature.properties.recordUuid ?? feature.properties.count.toLocaleString("es-BO")}`;
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
          else
            featureLayer.on("click", () =>
              selection.current?.(feature.properties),
            );
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
      if (
        !selectedAppIds.length &&
        !selectedProjectIds.length &&
        !selectedLocalCollectionIds.length
      ) {
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
      const url = buildMapRecordsUrl(getApiBase(), {
        mode,
        bbox: viewport,
        zoom: instance.getZoom(),
        appIds: selectedAppIds,
        projectIds: selectedProjectIds,
        localCollectionIds: selectedLocalCollectionIds,
      });
      const cacheScope = workspaceScopeKey({
        mode,
        appIds: selectedAppIds,
        projectIds: selectedProjectIds,
        localCollectionIds: selectedLocalCollectionIds,
      });
      const key = cacheKeys.map({
        mode,
        appIds: selectedAppIds,
        projectIds: selectedProjectIds,
        localCollectionIds: selectedLocalCollectionIds,
        bbox: viewport,
        zoom: Math.round(instance.getZoom()),
        representation: "server",
      });
      let cached = await localDataCache.read<MapResponse>(key);
      if (cached) {
        await render(cached.value);
        setLoading(false);
        setError("");
        const sync = await synchronizeWorkspaceScope({
          mode,
          appIds: selectedAppIds,
          projectIds: selectedProjectIds,
          localCollectionIds: selectedLocalCollectionIds,
        });
        if (sync.invalidated) cached = null;
        if (cached && !cached.stale && !sync.initialized && !sync.invalidated)
          return;
      }
      controller = new AbortController();
      setLoading(true);
      try {
        const result = await fetch(url, { signal: controller.signal });
        if (!result.ok) throw new Error("No se pudo consultar el mapa.");
        const response = (await result.json()) as MapResponse;
        await localDataCache.write(key, response, {
          category: "map",
          scope: cacheScope,
          maxAgeMs: 90_000,
        });
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

    const scheduleLoad = () => {
      if (timer !== null) window.clearTimeout(timer);
      timer = window.setTimeout(() => void loadVisible(), 180);
    };
    instance.on("moveend", scheduleLoad);
    instance.on("zoomend", scheduleLoad);
    void loadVisible();
    return () => {
      active = false;
      controller?.abort();
      if (timer !== null) window.clearTimeout(timer);
      instance.off("moveend", scheduleLoad);
      instance.off("zoomend", scheduleLoad);
    };
  }, [
    appIdsKey,
    initialized,
    localCollectionIdsKey,
    mode,
    onStatus,
    onViewportChange,
    projectIdsKey,
    refresh,
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
