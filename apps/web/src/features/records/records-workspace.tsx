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
  const [refresh, setRefresh] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setProjectId(initialProjectId);
  }, [initialProjectId]);

  useEffect(() => {
    if (initialDatasetId) {
      setDatasetId(initialDatasetId);
    } else if (!projectId && !datasetId) {
      const fallback =
        catalog.apps[0]?.dataset_id ?? catalog.collections[0]?.id ?? "";
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
    if (!catalog || !bbox || (!datasetId && !projectId)) return;

    let cancelled = false;
    const query = new URLSearchParams();
    const scope = recordScope(catalog, projectId, datasetId);

    query.set("mode", scope.mode);
    if (scope.appIds?.length) query.set("appIds", scope.appIds.join(","));
    if (scope.projectIds?.length)
      query.set("projectIds", scope.projectIds.join(","));
    if (scope.localCollectionIds?.length)
      query.set("localCollectionIds", scope.localCollectionIds.join(","));
    if (bbox) query.set("bbox", bbox);
    if (cursor) query.set("cursor", cursor);
    query.set("limit", "100");

    const path = `/records?${query}`;
    const pageScope = workspaceScopeKey(scope);
    const cacheKey = cacheKeys.table({ path });

    const applyPage = (data: PageResponse) => {
      if (cancelled) return;
      setPage({
        total: data.totalRecords,
        nextCursor: data.nextCursor,
        rows: data.data.map((item) => ({
          record_id: item.recordUuid,
          project_record_id: item.projectRecordUuid,
          project_app_id: item.projectAppId,
          dataset_id: item.datasetId,
          revision: item.revision,
          attributes: item.attributes,
          geometry: item.geometry,
          display_geometry: item.geometry,
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
                <button
                  disabled={!cursor || loading}
                  onClick={() => setCursor("")}
                  className="px-2 py-0.5 text-[11px] bg-white border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-40 transition"
                >
                  Inicio
                </button>
                <button
                  disabled={!page.nextCursor || loading}
                  onClick={() => setCursor(page.nextCursor ?? "")}
                  className="px-2.5 py-0.5 text-[11px] bg-sky-50 text-sky-700 border border-sky-200 rounded font-medium hover:bg-sky-100 disabled:opacity-40 transition"
                >
                  Siguiente página →
                </button>
              </div>
            </div>

            {/* Table contents */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left text-xs text-slate-700 border-collapse">
                <thead className="bg-slate-100/90 sticky top-0 border-b border-slate-200 z-10">
                  <tr>
                    <th className="py-2 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider w-20">
                      ID
                    </th>
                    {fields.slice(0, 5).map((f) => (
                      <th
                        key={f.id}
                        className="py-2 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider truncate max-w-[140px]"
                      >
                        {f.label}
                      </th>
                    ))}
                    {!fields.length && (
                      <th className="py-2 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider">
                        Atributos
                      </th>
                    )}
                    <th className="py-2 px-3 font-semibold text-slate-700 text-[11px] uppercase tracking-wider text-right w-24">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {page.rows.length > 0 ? (
                    page.rows.map((row) => (
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
                        <td className="py-2 px-3 font-mono text-[11px] text-slate-500">
                          {row.record_id.slice(0, 8)}
                        </td>
                        {fields.slice(0, 5).map((f) => (
                          <td
                            key={f.id}
                            className="py-2 px-3 truncate max-w-[140px]"
                          >
                            {String(row.attributes[f.id] ?? "—")}
                          </td>
                        ))}
                        {!fields.length && (
                          <td className="py-2 px-3 truncate max-w-[200px] text-slate-500 text-[11px]">
                            {Object.entries(row.attributes)
                              .map(([k, v]) => `${k}: ${v}`)
                              .join(" · ") || "—"}
                          </td>
                        )}
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setDatasetId(row.dataset_id);
                              setSelectedRow(row);
                            }}
                            className="px-2 py-0.5 text-[11px] text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-medium transition"
                          >
                            {projectId ? "Editar" : "Detalle"}
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={fields.length + 2}
                        className="py-12 text-center text-slate-400 italic text-xs"
                      >
                        {loading
                          ? "Consultando registros en el área…"
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
          datasetId={datasetId}
          catalog={catalog}
          collection={activeCollection}
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
