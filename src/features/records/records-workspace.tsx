"use client";

import { useState, useEffect, useCallback } from "react";
import type { Catalog, Collection, Row } from "../operational/contracts";
import { api } from "../operational/contracts";
import { recordScope } from "../operational/record-scope";
import {
  cacheKeys,
  canPrefetch,
  localDataCache,
} from "../../lib/local-data-cache";
import {
  synchronizeWorkspaceScope,
  workspaceScopeKey,
} from "../../lib/incremental-workspace-sync";
import { RecordMap } from "../operational/record-map";
import { RecordInspector } from "./record-inspector";
import { RecordCreateModal } from "./record-create-modal";

type Props = {
  catalog: Catalog;
  initialProjectId?: string;
  initialDatasetId?: string;
  onNavigateToImport: (projectId: string, datasetId: string) => void;
};

type ViewMode = "split" | "map" | "table";
type SplitTablePosition = "side" | "bottom";

type PageResponse = {
  data: {
    recordUuid: string;
    projectRecordUuid: string | null;
    projectAppId: string | null;
    datasetId: string;
    revision: number;
    attributes: Record<string, unknown>;
    geometry: GeoJSON.Geometry;
  }[];
  totalRecords: number;
  nextCursor: string | null;
};

export function RecordsWorkspace({
  catalog,
  initialProjectId = "",
  initialDatasetId = "",
  onNavigateToImport,
}: Props) {
  const defaultDataset =
    initialDatasetId ||
    (initialProjectId
      ? ""
      : (catalog.apps[0]?.dataset_id ?? catalog.collections[0]?.id ?? ""));

  const [projectId, setProjectId] = useState(initialProjectId);
  const [datasetId, setDatasetId] = useState(defaultDataset);
  const [viewMode, setViewMode] = useState<ViewMode>("split");
  const [splitTablePosition, setSplitTablePosition] =
    useState<SplitTablePosition>("side");
  const [bbox, setBbox] = useState("-180,-90,180,90");
  const [cursor, setCursor] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [currentScale, setCurrentScale] = useState<number>(2145000);
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Helper to extract attribute values cleanly
  const getRowFieldValue = useCallback((rowAttrs: Record<string, unknown>, f: any): string => {
    if (!rowAttrs) return "—";
    const directKey = (f as any).key;
    if (directKey && rowAttrs[directKey] !== undefined && rowAttrs[directKey] !== null) {
      return String(rowAttrs[directKey]);
    }
    if (f.id && rowAttrs[f.id] !== undefined && rowAttrs[f.id] !== null) {
      return String(rowAttrs[f.id]);
    }
    const stripped = f.id?.replace(/^f-[a-z0-9]+-/, "").replace(/^f-/, "");
    if (stripped && rowAttrs[stripped] !== undefined && rowAttrs[stripped] !== null) {
      return String(rowAttrs[stripped]);
    }
    for (const [k, v] of Object.entries(rowAttrs)) {
      if (k.toLowerCase() === directKey?.toLowerCase() || k.toLowerCase() === stripped?.toLowerCase()) {
        if (v !== undefined && v !== null) return String(v);
      }
    }
    return "—";
  }, []);

  // Fetch scale status
  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ totalNodes: number }>("/scale");
        if (res && res.totalNodes) {
          setCurrentScale(res.totalNodes);
        }
      } catch {
        // Fallback default
      }
    })();
  }, []);

  const handleToggleScale = async () => {
    const targetScale = currentScale >= 2000000 ? 1000000 : 2145000;
    try {
      setLoading(true);
      await api("/scale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scale: targetScale }),
      });
      setCurrentScale(targetScale);
      setCursor("");
      setRefresh((r) => r + 1);
    } catch {
      // Ignored
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (initialDatasetId) {
      setDatasetId(initialDatasetId);
    } else if (!projectId && !datasetId) {
      const fallback =
        catalog.apps[0]?.dataset_id ?? catalog.collections[0]?.id ?? "ds-postes";
      if (fallback) setDatasetId(fallback);
    }
  }, [initialDatasetId, catalog, projectId, datasetId]);

  const [page, setPage] = useState<{
    total: number;
    nextCursor: string | null;
    rows: Row[];
  }>({ total: 0, nextCursor: null, rows: [] });

  const [selectedRow, setSelectedRow] = useState<Row | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Available collections
  const uniqueCollections = catalog.collections.filter(
    (c, i, list) =>
      (!projectId || c.project_id === projectId) &&
      list.findIndex((x) => x.id === c.id) === i,
  );

  const activeCollection = catalog.collections.find((c) => c.id === datasetId);
  const fields =
    activeCollection?.schema_definition.sections.flatMap((s) => s.fields) ?? [];

  // Update bounds handler from map
  const handleBoundsChange = useCallback((newBbox: string) => {
    setBbox(newBbox);
    setCursor("");
  }, []);

  // Fetch paginated table records with caching and incremental sync
  useEffect(() => {
    if (!catalog || !bbox) return;

    let cancelled = false;
    const query = new URLSearchParams();
    const scope = recordScope(catalog, projectId, datasetId);

    query.set("mode", scope.mode);
    if (datasetId) query.set("datasetId", datasetId);
    if (projectId) query.set("projectId", projectId);
    if (scope.appIds?.length) query.set("appIds", scope.appIds.join(","));
    if (scope.projectIds?.length)
      query.set("projectIds", scope.projectIds.join(","));
    if (scope.localCollectionIds?.length)
      query.set("localCollectionIds", scope.localCollectionIds.join(","));
    if (bbox) query.set("bbox", bbox);
    if (cursor) query.set("cursor", cursor);
    if (searchTerm.trim()) query.set("search", searchTerm.trim());
    query.set("limit", "100");

    const path = `/records?${query}`;
    const pageScope = workspaceScopeKey(scope);
    const cacheKey = cacheKeys.table({ path });

    const applyPage = (data: any) => {
      if (cancelled || !data) return;
      const rawList: any[] = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.rows)
          ? data.rows
          : [];
      setPage({
        total: data.totalRecords ?? data.total ?? rawList.length,
        nextCursor: data.nextCursor ?? null,
        rows: rawList.map((item: any) => ({
          record_id: item.recordUuid || item.record_id || item.id,
          project_record_id:
            item.projectRecordUuid ?? item.project_record_id ?? null,
          project_app_id: item.projectAppId ?? item.project_app_id ?? null,
          dataset_id: item.datasetId ?? item.dataset_id ?? "",
          revision: item.revision ?? 1,
          attributes: item.attributes ?? {},
          geometry: item.geometry ?? null,
          display_geometry: item.geometry ?? null,
        })),
      });
    };

    void (async () => {
      setLoading(true);
      try {
        let cached = await localDataCache.read<PageResponse>(cacheKey);
        if (cached) applyPage(cached.value);

        if (cached) {
          const sync = await synchronizeWorkspaceScope(scope);
          if (sync.invalidated) cached = null;
          if (
            cached &&
            !cached.stale &&
            !sync.initialized &&
            !sync.invalidated
          ) {
            setLoading(false);
            return;
          }
        }

        const data = await api<PageResponse>(path);
        await localDataCache.write(cacheKey, data, {
          category: "table",
          scope: pageScope,
          maxAgeMs: 90_000,
        });
        await synchronizeWorkspaceScope(scope);
        applyPage(data);

        // Prefetch next page if applicable
        if (data.nextCursor && canPrefetch()) {
          const nextQuery = new URLSearchParams(query);
          nextQuery.set("cursor", data.nextCursor);
          const nextPath = `/records?${nextQuery}`;
          const nextKey = cacheKeys.table({ path: nextPath });
          const nextCached = await localDataCache.read<PageResponse>(nextKey);
          if (!nextCached) {
            void api<PageResponse>(nextPath).then((nextPage) =>
              localDataCache.write(nextKey, nextPage, {
                category: "table",
                scope: pageScope,
                maxAgeMs: 90_000,
              }),
            );
          }
        }
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Error al cargar registros",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalog, projectId, datasetId, bbox, cursor, refresh]);

  // Handle escape key to close inspector
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRow(null);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden bg-slate-100 font-sans">
      {/* Top Operational Bar (48-56px) */}
      <header className="relative z-[1100] h-13 bg-slate-900 text-white px-4 flex items-center justify-between border-b border-slate-800 gap-3 shrink-0">
        {/* Left section: Title & Context selectors */}
        <div className="flex items-center gap-3 overflow-x-auto py-1">
          <div className="flex items-center gap-2 shrink-0">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
            <h1 className="text-sm font-semibold tracking-wide text-white">
              Registros
            </h1>
          </div>

          <div className="h-4 w-px bg-slate-700 shrink-0" />

          {/* Context Selector: App vs Project */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <span className="text-slate-400 font-medium">Contexto:</span>
            <select
              value={projectId}
              onChange={(e) => {
                setProjectId(e.target.value);
                setDatasetId("");
                setCursor("");
              }}
              className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium"
            >
              <option value="">App independiente</option>
              {catalog.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  Proyecto: {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Collection / Layer Selector */}
          <div className="flex items-center gap-1.5 shrink-0 text-xs">
            <span className="text-slate-400 font-medium">Capa:</span>
            <select
              value={datasetId}
              onChange={(e) => {
                setDatasetId(e.target.value);
                setCursor("");
              }}
              className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded border border-slate-700 hover:border-slate-600 focus:outline-none focus:ring-1 focus:ring-sky-500 font-medium max-w-[200px] truncate"
            >
              <option value="">
                {projectId ? "Todas las colecciones" : "Seleccionar App"}
              </option>
              {uniqueCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.local_project_id ? "(Local)" : ""}
                </option>
              ))}
            </select>
          </div>

          {/* Count Badge */}
          <span className="bg-slate-800 text-sky-400 border border-slate-700 px-2.5 py-0.5 rounded text-xs font-semibold shrink-0">
            {page.total} registros
          </span>

          {/* Scale Indicator & Simulation Control */}
          <button
            onClick={handleToggleScale}
            title="Alternar entre simulación de 1M y 2.14M de Nodos"
            className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-sky-950/80 border border-sky-600/50 text-sky-300 text-xs hover:bg-sky-900 transition shrink-0"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span className="font-semibold">
              {currentScale >= 2000000 ? "2.14M Nodos" : "1.00M Nodos"}
            </span>
            <span className="text-[10px] text-sky-400/80 hidden sm:inline">(Cambiar)</span>
          </button>
        </div>

        {/* Right section: Action buttons & View toggles */}
        <div className="flex items-center gap-2 shrink-0">
          {/* View mode toggles */}
          <div className="flex items-center bg-slate-800 p-0.5 rounded border border-slate-700 text-xs font-medium">
            <button
              onClick={() => setViewMode("map")}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === "map"
                  ? "bg-sky-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Vista de mapa completa"
            >
              Mapa
            </button>
            <button
              onClick={() => setViewMode("split")}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === "split"
                  ? "bg-sky-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Vista dividida (Mapa + Tabla)"
            >
              Dividido
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-2.5 py-1 rounded transition ${
                viewMode === "table"
                  ? "bg-sky-600 text-white shadow-xs font-semibold"
                  : "text-slate-300 hover:text-white"
              }`}
              title="Vista de tabla completa"
            >
              Tabla
            </button>
          </div>

          {viewMode === "split" && (
            <button
              type="button"
              onClick={() =>
                setSplitTablePosition((position) =>
                  position === "side" ? "bottom" : "side",
                )
              }
              className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
              title={
                splitTablePosition === "side"
                  ? "Mover la tabla debajo del mapa"
                  : "Mover la tabla al lado del mapa"
              }
            >
              {splitTablePosition === "side" ? "Tabla abajo" : "Tabla al lado"}
            </button>
          )}

          <div className="h-4 w-px bg-slate-700" />

          {/* Import Button */}
          <button
            onClick={() => onNavigateToImport(projectId, datasetId)}
            className="px-2.5 py-1 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition"
          >
            Importar
          </button>

          {/* New Record Button */}
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="px-3 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition flex items-center gap-1"
          >
            <span>+</span> Nuevo registro
          </button>
        </div>
      </header>

      {/* Error alert */}
      {error && (
        <div className="p-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs flex items-center justify-between px-4 shrink-0">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="text-rose-500 hover:text-rose-700 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {/* Main Workspace Layout (Map + Table depending on viewMode) */}
      <div
        className={`flex-1 flex min-h-0 relative ${
          viewMode === "split" && splitTablePosition === "side"
            ? "flex-col md:flex-row"
            : "flex-col"
        }`}
      >
        {/* Map Container */}
        {(viewMode === "map" || viewMode === "split") && (
          <div
            className={`records-workspace-map-panel relative isolate z-0 flex flex-col min-w-0 overflow-hidden ${
              viewMode === "split"
                ? splitTablePosition === "side"
                  ? "w-full md:w-1/2 h-1/2 md:h-full border-b md:border-b-0 md:border-r border-slate-300"
                  : "w-full h-1/2 border-b border-slate-300"
                : "w-full h-full"
            }`}
          >
            <div className="min-h-0 flex-1 relative overflow-hidden">
              <RecordMap
                catalog={catalog}
                projectId={projectId}
                datasetId={datasetId}
                refresh={refresh}
                onBounds={handleBoundsChange}
                onSelect={(row) => {
                  setDatasetId(row.dataset_id);
                  setSelectedRow(row);
                }}
              />
            </div>

            {/* Compact Map Overlay Status */}
            <div className="absolute top-2 left-2 z-10 bg-slate-900/80 backdrop-blur-xs text-white text-[11px] px-2.5 py-1 rounded shadow-md border border-slate-700 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>Sincronizado con visor</span>
              <button
                onClick={() => {
                  setBbox("-180,-90,180,90");
                  setCursor("");
                }}
                className="underline text-sky-300 hover:text-sky-200 ml-1"
              >
                Reset BBOX
              </button>
            </div>
          </div>
        )}

        {/* Table Container */}
        {(viewMode === "table" || viewMode === "split") && (
          <div
            className={`relative z-10 flex flex-col min-w-0 bg-white overflow-hidden ${
              viewMode === "split"
                ? splitTablePosition === "side"
                  ? "w-full md:w-1/2 h-1/2 md:h-full"
                  : "w-full h-1/2"
                : "w-full h-full"
            }`}
          >
            {/* Table status header */}
            <div className="h-9 px-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between text-xs text-slate-600 shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-slate-700">
                  Registros en el área
                </span>
                <span className="text-[11px] text-slate-400">
                  (Paginación servidor · 100 máx)
                </span>
                {loading && (
                  <span className="text-sky-600 animate-pulse text-[11px]">
                    Cargando…
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Buscar código, zona..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCursor("");
                  }}
                  className="text-xs px-2.5 py-1 border border-slate-300 rounded bg-white w-44 text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-sky-500"
                />
                <button
                  disabled={!cursor || loading}
                  onClick={() => setCursor("")}
                  className="px-2 py-1 text-[11px] bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Inicio
                </button>
                <button
                  disabled={!page.nextCursor || loading}
                  onClick={() => setCursor(page.nextCursor ?? "")}
                  className="px-2.5 py-1 text-[11px] bg-sky-50 text-sky-700 border border-sky-200 rounded font-medium hover:bg-sky-100 disabled:opacity-40 transition"
                >
                  Siguiente →
                </button>
              </div>
            </div>

            {/* Table contents */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider w-24">
                      ID
                    </th>
                    {fields.length > 0 ? (
                      fields.slice(0, 6).map((f) => (
                        <th
                          key={f.id}
                          className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider truncate max-w-[160px]"
                        >
                          {f.label}
                        </th>
                      ))
                    ) : (
                      <>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider w-36">
                          Capa / Tipo
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider w-36">
                          Código
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider w-36">
                          Ubicación
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider w-32">
                          Estado
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                          Atributos Técnicos
                        </th>
                      </>
                    )}
                    <th className="py-2.5 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider text-right w-24">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {page.rows.length > 0 ? (
                    page.rows.map((row) => {
                      const colMeta = catalog.collections.find((c) => c.id === row.dataset_id);
                      const isTap = row.dataset_id === "ds-taps";
                      const isPoste = row.dataset_id === "ds-postes";
                      const isSplitter = row.dataset_id === "ds-splitters";
                      const isMufa = row.dataset_id === "ds-mufas";

                      return (
                        <tr
                          key={row.project_record_id ?? row.record_id}
                          onClick={() => {
                            setDatasetId(row.dataset_id);
                            setSelectedRow(row);
                          }}
                          className={`hover:bg-sky-50/60 cursor-pointer transition ${
                            selectedRow?.record_id === row.record_id
                              ? "bg-sky-50 font-medium"
                              : ""
                          }`}
                        >
                          <td className="py-2.5 px-3 font-mono text-[11px] text-slate-500">
                            {row.record_id.slice(0, 10)}
                          </td>
                          {fields.length > 0 ? (
                            fields.slice(0, 6).map((f) => {
                              const display = getRowFieldValue(row.attributes, f);
                              return (
                                <td
                                  key={f.id}
                                  className="py-2.5 px-3 truncate max-w-[160px] text-slate-700 font-medium"
                                  title={display !== "—" ? display : undefined}
                                >
                                  {display}
                                </td>
                              );
                            })
                          ) : (
                            <>
                              <td className="py-2.5 px-3 truncate max-w-[140px]">
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold ${
                                    isTap
                                      ? "bg-sky-100 text-sky-800"
                                      : isPoste
                                        ? "bg-rose-100 text-rose-800"
                                        : isSplitter
                                          ? "bg-purple-100 text-purple-800"
                                          : isMufa
                                            ? "bg-amber-100 text-amber-800"
                                            : "bg-slate-100 text-slate-800"
                                  }`}
                                >
                                  {colMeta?.name || row.dataset_id}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 font-mono font-semibold text-slate-800">
                                {String(row.attributes.codigo || row.attributes.code || "—")}
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 truncate max-w-[140px]">
                                {String(
                                  row.attributes.municipio ||
                                  row.attributes.zona ||
                                  row.attributes.departamento ||
                                  "—"
                                )}
                              </td>
                              <td className="py-2.5 px-3">
                                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                                  {String(row.attributes.estado || "Operativo")}
                                </span>
                              </td>
                              <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                <div className="flex flex-wrap gap-1.5 items-center">
                                  {isPoste && (
                                    <>
                                      <span className="px-1.5 py-0.2 bg-slate-100 rounded text-slate-700">
                                        {String(row.attributes.tipo_poste || "Hormigón")}
                                      </span>
                                      <span className="text-slate-500">
                                        {String(row.attributes.altura_m ? `${row.attributes.altura_m}m` : "")}
                                      </span>
                                      <span className="text-slate-400">
                                        {String(row.attributes.propietario || "")}
                                      </span>
                                    </>
                                  )}
                                  {isTap && (
                                    <>
                                      <span className="px-1.5 py-0.2 bg-sky-50 text-sky-800 rounded font-medium">
                                        {String(row.attributes.capacidad_puertos || "16 Puertos")}
                                      </span>
                                      <span className="text-slate-600">
                                        Ocup: {String(row.attributes.puertos_ocupados ?? 0)}
                                      </span>
                                      <span className="text-slate-400">
                                        {String(row.attributes.atenuacion_dbm ? `${row.attributes.atenuacion_dbm} dBm` : "")}
                                      </span>
                                    </>
                                  )}
                                  {isSplitter && (
                                    <>
                                      <span className="px-1.5 py-0.2 bg-purple-50 text-purple-800 rounded font-medium">
                                        {String(row.attributes.tipo_splitter || "1:16")}
                                      </span>
                                      <span className="text-slate-500">
                                        {String(row.attributes.caja_alojamiento || "Caja Aérea")}
                                      </span>
                                    </>
                                  )}
                                  {!isPoste && !isTap && !isSplitter && (
                                    <span>
                                      {Object.entries(row.attributes)
                                        .filter(([k]) => !k.startsWith("f-") && k !== "codigo")
                                        .slice(0, 3)
                                        .map(([k, v]) => `${k.replace(/_/g, " ")}: ${v}`)
                                        .join(" · ") || "—"}
                                    </span>
                                  )}
                                </div>
                              </td>
                            </>
                          )}
                          <td className="py-2.5 px-3 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDatasetId(row.dataset_id);
                                setSelectedRow(row);
                              }}
                              className="px-2.5 py-1 text-[11px] text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-semibold transition"
                            >
                              {projectId ? "Editar" : "Atributos"}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td
                        colSpan={fields.length ? fields.length + 2 : 7}
                        className="py-12 text-center text-slate-400 italic text-xs"
                      >
                        {loading
                          ? "Consultando registros en la base de datos nacional…"
                          : "No hay registros disponibles en esta vista o área del mapa."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Record Inspector Drawer */}
      {selectedRow && (
        <RecordInspector
          row={selectedRow}
          projectId={projectId}
          datasetId={selectedRow.dataset_id || datasetId}
          catalog={catalog}
          collection={
            catalog.collections.find((c) => c.id === selectedRow.dataset_id) ??
            activeCollection
          }
          onClose={() => setSelectedRow(null)}
          onUpdated={() => {
            setRefresh((v) => v + 1);
          }}
        />
      )}

      {/* Record Create Modal */}
      {isCreateModalOpen && (
        <RecordCreateModal
          catalog={catalog}
          projectId={projectId}
          datasetId={datasetId}
          collection={activeCollection}
          onClose={() => setIsCreateModalOpen(false)}
          onCreated={() => {
            setRefresh((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}
