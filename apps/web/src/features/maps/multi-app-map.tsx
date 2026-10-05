"use client";
import { getApiBase } from "../../lib/api-base";
import { cacheKeys, localDataCache } from "../../lib/local-data-cache";
import {
  synchronizeWorkspaceScope,
  workspaceScopeKey,
} from "../../lib/incremental-workspace-sync";

import "leaflet/dist/leaflet.css";

import type { FeatureCollection, Geometry } from "geojson";
import type { FeatureGroup, GeoJSON, Map as LeafletMap } from "leaflet";
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
  rendering?: MapRenderingSummary;
}>;

type CachedCoverage = Readonly<{
  scope: string;
  zoom: number;
  bounds: MapBounds;
  response: MapResponse;
}>;

type RenderedFeature = Readonly<{
  signature: string;
  layer: GeoJSON;
}>;

export type MapGeometryRendering = Readonly<{
  total: number;
  rendered: number;
  truncated: boolean;
  simplified: boolean;
}>;

export type MapRenderingSummary = Readonly<{
  points: MapGeometryRendering & Readonly<{ clustered: boolean }>;
  lines: MapGeometryRendering;
  polygons: MapGeometryRendering;
}>;

export type MultiAppMapStatus = Readonly<{
  visibleFeatures: number;
  totalRecords: number;
  clustered: boolean;
  truncated: boolean;
  rendering: MapRenderingSummary;
}>;

export const emptyMapRendering: MapRenderingSummary = {
  points: {
    total: 0,
    rendered: 0,
    truncated: false,
    simplified: false,
    clustered: false,
  },
  lines: { total: 0, rendered: 0, truncated: false, simplified: false },
  polygons: { total: 0, rendered: 0, truncated: false, simplified: false },
};

type Props = Readonly<{
  mode?: MapMode;
  appIds: readonly string[];
  projectIds?: readonly string[];
  localCollectionIds?: readonly string[];
  segmentIds?: readonly string[];
  onStatus: (status: MultiAppMapStatus) => void;
  /** The records table already owns an exact bbox count; avoid duplicating it. */
  viewportTotal?: number;
  onViewportChange?: (bounds: MapBounds) => void;
  onSelect?: (feature: MapFeature) => void;
  refresh?: number;
}>;

const emptyStatus: MultiAppMapStatus = {
  visibleFeatures: 0,
  totalRecords: 0,
  clustered: true,
  truncated: false,
  rendering: emptyMapRendering,
};

function fallbackRendering(response: MapResponse): MapRenderingSummary {
  const points = response.data.filter(
    (feature) => feature.geometry.type === "Point",
  );
  const lines = response.data.filter(
    (feature) => feature.geometry.type === "LineString",
  );
  const polygons = response.data.filter(
    (feature) => feature.geometry.type === "Polygon",
  );
  return {
    points: {
      total: points.reduce((total, feature) => total + feature.count, 0),
      rendered: points.length,
      truncated: response.truncated,
      simplified: false,
      clustered: response.clustered,
    },
    lines: {
      total: lines.length,
      rendered: lines.length,
      truncated: false,
      simplified: false,
    },
    polygons: {
      total: polygons.length,
      rendered: polygons.length,
      truncated: false,
      simplified: false,
    },
  };
}

function clusterMarkerHtml(feature: MapFeature): string {
  const color = normalizeMapColor(feature.symbol.color);
  const formattedCount =
    feature.count >= 1_000_000
      ? `${(feature.count / 1_000_000).toFixed(1)}M`
      : feature.count >= 10_000
        ? `${Math.round(feature.count / 1_000)}k`
        : feature.count >= 1_000
          ? `${(feature.count / 1_000).toFixed(1)}k`
          : String(feature.count);
  const icon = feature.symbol.icon;
  return `<span class="multi-map-cluster" style="--cluster-color:${color}">
    <svg aria-hidden="true" viewBox="0 0 24 24"><use href="/map-symbols.svg#map-icon-${icon}"></use></svg>
    <b>${formattedCount}</b>
  </span>`;
}

function expandBounds(bounds: MapBounds, padding = 0.4): MapBounds {
  const [west, south, east, north] = bounds;
  const horizontal = (east - west) * padding;
  const vertical = (north - south) * padding;
  return [
    Math.max(-180, west - horizontal),
    Math.max(-90, south - vertical),
    Math.min(180, east + horizontal),
    Math.min(90, north + vertical),
  ];
}

function containsBounds(outer: MapBounds, inner: MapBounds): boolean {
  return (
    outer[0] <= inner[0] &&
    outer[1] <= inner[1] &&
    outer[2] >= inner[2] &&
    outer[3] >= inner[3]
  );
}

function featureSignature(feature: MapFeature): string {
  return JSON.stringify({
    geometry: feature.geometry,
    symbol: feature.symbol,
    count: feature.count,
    isCluster: feature.isCluster ?? false,
    revision: feature.revision,
  });
}

function withViewportTotals(
  summary: MapResponse,
  rendered: MapResponse | null,
): MultiAppMapStatus {
  const summaryRendering = summary.rendering ?? fallbackRendering(summary);
  const renderedRendering = rendered
    ? (rendered.rendering ?? fallbackRendering(rendered))
    : emptyMapRendering;
  return {
    visibleFeatures: rendered?.data.length ?? 0,
    totalRecords: summary.totalRecords,
    clustered: summary.clustered,
    truncated: rendered?.truncated ?? false,
    rendering: {
      points: {
        ...summaryRendering.points,
        rendered: renderedRendering.points.rendered,
        truncated: renderedRendering.points.truncated,
        simplified: renderedRendering.points.simplified,
      },
      lines: {
        ...summaryRendering.lines,
        rendered: renderedRendering.lines.rendered,
        truncated: renderedRendering.lines.truncated,
        simplified: renderedRendering.lines.simplified,
      },
      polygons: {
        ...summaryRendering.polygons,
        rendered: renderedRendering.polygons.rendered,
        truncated: renderedRendering.polygons.truncated,
        simplified: renderedRendering.polygons.simplified,
      },
    },
  };
}

export function MultiAppMap({
  mode = "app",
  appIds,
  projectIds = [],
  localCollectionIds = [],
  segmentIds = [],
  onStatus,
  viewportTotal,
  onViewportChange,
  onSelect,
  refresh = 0,
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const featureGroup = useRef<FeatureGroup | null>(null);
  const renderedFeatures = useRef<Map<string, RenderedFeature>>(new Map());
  const coverage = useRef<CachedCoverage | null>(null);
  const fitted = useRef(false);
  const selection = useRef(onSelect);
  const knownViewportTotal = useRef<number | null>(viewportTotal ?? null);
  selection.current = onSelect;
  knownViewportTotal.current = viewportTotal ?? null;
  useEffect(() => {
    void localDataCache.invalidateCategory("map");
    coverage.current = null;
  }, [refresh]);
  const [initialized, setInitialized] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const appIdsKey = appIds.join(",");
  const projectIdsKey = projectIds.join(",");
  const localCollectionIdsKey = localCollectionIds.join(",");
  const segmentIdsKey = segmentIds.join(",");

  useEffect(() => {
    if (!container.current || map.current) return;
    let active = true;
    let resizeObserver: ResizeObserver | null = null;
    let resizeFrame: number | null = null;
    void import("leaflet").then((leaflet) => {
      if (!active || !container.current) return;
      const instance = leaflet
        .map(container.current, {
          maxZoom: 22,
          preferCanvas: true,
          zoomControl: false,
        })
        .setView([-16.7, -64.5], 5);
      leaflet.control.zoom({ position: "bottomright" }).addTo(instance);
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
      featureGroup.current = leaflet.featureGroup().addTo(instance);
      // Leaflet measures its container only at initialization. The records
      // workspace can change this container from a split panel to full width
      // without firing a browser resize event, so watch the actual element.
      if (typeof ResizeObserver !== "undefined") {
        resizeObserver = new ResizeObserver(() => {
          if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
          resizeFrame = window.requestAnimationFrame(() => {
            resizeFrame = null;
            map.current?.invalidateSize({ pan: false, debounceMoveend: true });
          });
        });
        resizeObserver.observe(container.current);
      }
      setInitialized(true);
      window.setTimeout(() => instance.invalidateSize(), 0);
    });
    return () => {
      active = false;
      resizeObserver?.disconnect();
      if (resizeFrame !== null) window.cancelAnimationFrame(resizeFrame);
      map.current?.remove();
      map.current = null;
      featureGroup.current = null;
      renderedFeatures.current.clear();
      coverage.current = null;
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
    const selectedSegmentIds = segmentIdsKey ? segmentIdsKey.split(",") : [];
    let controller: AbortController | null = null;
    let timer: number | null = null;
    let active = true;

    const clearFeatures = () => {
      featureGroup.current?.clearLayers();
      renderedFeatures.current.clear();
    };

    const renderFeatures = async (response: MapResponse) => {
      const leaflet = await import("leaflet");
      const group = featureGroup.current;
      if (!active || !map.current || !group) return;
      const nextKeys = new Set<string>();
      for (const item of response.data) {
        // A canonical record can be displayed independently and through a
        // Project. The context is part of the visual identity.
        const key = `${item.contextRef ?? "unknown"}:${item.id}`;
        nextKeys.add(key);
        const signature = featureSignature(item);
        if (renderedFeatures.current.get(key)?.signature === signature)
          continue;
        const previous = renderedFeatures.current.get(key);
        if (previous) group.removeLayer(previous.layer);
        const collection: FeatureCollection<Geometry, MapFeature> = {
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              id: item.id,
              geometry: item.geometry,
              properties: item,
            },
          ],
        };
        const nextLayer = leaflet.geoJSON(collection, {
          pointToLayer: (feature, latlng) => {
            const properties = feature.properties;
            const isCluster =
              properties.count > 1 || Boolean(properties.isCluster);
            return leaflet.marker(latlng, {
              icon: leaflet.divIcon({
                className: isCluster
                  ? "multi-map-cluster-icon"
                  : "record-map-div-icon",
                html: isCluster
                  ? clusterMarkerHtml(properties)
                  : mapIconMarkerHtml(
                      properties.symbol.icon,
                      properties.symbol.color,
                    ),
                iconAnchor: isCluster ? [24, 13] : [11, 11],
                iconSize: isCluster ? [48, 26] : [22, 22],
              }),
            });
          },
          style: (feature) => ({
            color: normalizeMapColor(feature?.properties.symbol.color ?? ""),
            dashArray: mapLineDashArray(
              feature?.properties.symbol.icon ?? "pin",
            ),
            fillOpacity: 0.18,
            weight: 3,
          }),
          onEachFeature: (feature, featureLayer) => {
            const tooltip = document.createElement("span");
            const isCluster =
              feature.properties.isCluster || feature.properties.count > 1;
            tooltip.textContent = isCluster
              ? `${feature.properties.symbol.label ?? "Registros"}: ${feature.properties.count.toLocaleString("es-BO")} · Clic para acercar`
              : `${feature.properties.symbol.label ?? "Registro"}: ${feature.properties.recordUuid ?? "Sin identificador"}`;
            featureLayer.bindTooltip(tooltip);
            if (isCluster)
              featureLayer.on("click", () => {
                if (feature.geometry.type !== "Point") return;
                const [longitude, latitude] = feature.geometry.coordinates;
                if (longitude !== undefined && latitude !== undefined)
                  instance.setView(
                    [latitude, longitude],
                    Math.min(22, instance.getZoom() + 2),
                  );
              });
            else
              featureLayer.on("click", () =>
                selection.current?.(feature.properties),
              );
          },
        });
        nextLayer.addTo(group);
        renderedFeatures.current.set(key, { signature, layer: nextLayer });
      }
      for (const [key, existing] of renderedFeatures.current) {
        if (nextKeys.has(key)) continue;
        group.removeLayer(existing.layer);
        renderedFeatures.current.delete(key);
      }
      if (!fitted.current && response.data.length) {
        const featureBounds = group.getBounds();
        if (featureBounds.isValid()) {
          fitted.current = true;
          map.current.fitBounds(featureBounds, {
            maxZoom: 12,
            padding: [24, 24],
          });
        }
      }
    };

    const request = async (url: string, signal: AbortSignal) => {
      const result = await fetch(url, { signal });
      if (!result.ok) throw new Error("No se pudo consultar el mapa.");
      return (await result.json()) as MapResponse;
    };

    const loadVisible = async () => {
      controller?.abort();
      if (
        !selectedAppIds.length &&
        !selectedProjectIds.length &&
        !selectedLocalCollectionIds.length
      ) {
        clearFeatures();
        coverage.current = null;
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
      const zoom = Math.round(instance.getZoom());
      const scope = {
        mode,
        appIds: selectedAppIds,
        projectIds: selectedProjectIds,
        localCollectionIds: selectedLocalCollectionIds,
      };
      const cacheScope = workspaceScopeKey(scope);
      const visualScope = JSON.stringify({
        ...scope,
        segmentIds: selectedSegmentIds,
      });
      const currentCoverage = coverage.current;
      const canReuseCoverage =
        currentCoverage?.scope === visualScope &&
        currentCoverage.zoom === zoom &&
        containsBounds(currentCoverage.bounds, viewport);
      if (!canReuseCoverage && currentCoverage?.scope !== visualScope)
        clearFeatures();
      controller = new AbortController();
      const signal = controller.signal;
      const summaryRequest =
        knownViewportTotal.current === null
          ? request(
              buildMapRecordsUrl(getApiBase(), {
                ...scope,
                segmentIds: selectedSegmentIds,
                bbox: viewport,
                zoom,
                includeFeatures: false,
              }),
              signal,
            )
          : null;
      try {
        let rendered = canReuseCoverage ? currentCoverage.response : null;
        if (!rendered) {
          setLoading(true);
          const sync = await synchronizeWorkspaceScope(scope);
          if (sync.invalidated) {
            coverage.current = null;
            await localDataCache.invalidateScope(cacheScope);
          }
          const coverageBounds = expandBounds(viewport);
          const key = cacheKeys.map({
            ...scope,
            bbox: coverageBounds,
            zoom,
            representation: "coverage-v1",
            segmentIds: selectedSegmentIds,
          });
          const cached = sync.invalidated
            ? null
            : await localDataCache.read<MapResponse>(key);
          if (cached && !cached.stale) {
            rendered = cached.value;
          } else {
            rendered = await request(
              buildMapRecordsUrl(getApiBase(), {
                ...scope,
                segmentIds: selectedSegmentIds,
                bbox: coverageBounds,
                zoom,
              }),
              signal,
            );
            await localDataCache.write(key, rendered, {
              category: "map",
              scope: cacheScope,
              maxAgeMs: 90_000,
            });
          }
          if (!active || signal.aborted) return;
          coverage.current = {
            scope: visualScope,
            zoom,
            bounds: coverageBounds,
            response: rendered,
          };
          await renderFeatures(rendered);
        }
        const summary = summaryRequest ? await summaryRequest : null;
        if (!active || signal.aborted) return;
        onStatus(
          summary
            ? withViewportTotals(summary, rendered)
            : {
                ...withViewportTotals(rendered, rendered),
                totalRecords:
                  knownViewportTotal.current ?? rendered.totalRecords,
              },
        );
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
        if (active && !signal.aborted) setLoading(false);
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
    segmentIdsKey,
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
