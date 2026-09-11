"use client";

import { useEffect, useState, useCallback } from "react";
import type { Catalog, Collection, Row } from "../operational/contracts";
import { api } from "../operational/contracts";
import { cacheKeys, localDataCache } from "../../lib/local-data-cache";

type RecordDetailData = {
  id?: string;
  dataset_id?: string;
  revision: number;
  attributes: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
  display_geometry?: GeoJSON.Geometry | null;
  history?: {
    operation: string;
    snapshot: unknown;
    created_at: string;
  }[];
  // Project record specific fields if returned
  baseline_attributes?: Record<string, unknown>;
  attributes_override?: Record<string, unknown>;
  project_attributes?: Record<string, unknown>;
  geometry_override?: GeoJSON.Geometry | null;
};

type Props = {
  row: Row;
  projectId: string;
  datasetId: string;
  catalog: Catalog;
  collection?: Collection;
  onClose: () => void;
  onUpdated: () => void;
};

export function RecordInspector({
  row,
  projectId,
  datasetId,
  catalog,
  collection,
  onClose,
  onUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<
    "attributes" | "geometry" | "context"
  >("attributes");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [geometryText, setGeometryText] = useState("");
  const [detail, setDetail] = useState<RecordDetailData | null>(null);
  const [history, setHistory] = useState<RecordDetailData["history"]>([]);
  const [targetProject, setTargetProject] = useState("");
  const [targetProjectAppId, setTargetProjectAppId] = useState("");
  const [incorporateSuccess, setIncorporateSuccess] = useState(false);

  const isProjectContext = Boolean(projectId && row.project_record_id);
  const fields =
    collection?.schema_definition.sections.flatMap((s) => s.fields) ?? [];

  // Load record detail via active endpoints with local data cache
  const loadDetail = useCallback(async () => {
    setLoading(true);
    setError("");
    const path = isProjectContext
      ? `/projects/${projectId}/records/${row.project_record_id}`
      : `/records/${row.record_id}`;

    const cacheKey = cacheKeys.recordDetail({
      path,
      recordId: row.record_id,
      projectRecordId: row.project_record_id,
      revision: row.revision,
    });

    try {
      const cached = await localDataCache.read<RecordDetailData>(cacheKey);
      if (cached) {
        setDetail(cached.value);
        setValues(cached.value.attributes ?? {});
        setGeometryText(
          cached.value.geometry
            ? JSON.stringify(cached.value.geometry, null, 2)
            : "",
        );
        if (cached.value.history) setHistory(cached.value.history);
      }

      if (!cached || cached.stale) {
        const fresh = await api<RecordDetailData>(path);
        setDetail(fresh);
        setValues(fresh.attributes ?? {});
        setGeometryText(
          fresh.geometry ? JSON.stringify(fresh.geometry, null, 2) : "",
        );
        if (fresh.history) setHistory(fresh.history);

        await localDataCache.write(cacheKey, fresh, {
          category: "record-detail",
          scope: row.project_record_id
            ? `project-record:${row.project_record_id}`
            : `record:${row.record_id}`,
          maxAgeMs: 5 * 60 * 1000,
          revision: fresh.revision,
        });
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Error al cargar detalle del registro",
      );
    } finally {
      setLoading(false);
    }
  }, [
    isProjectContext,
    projectId,
    row.project_record_id,
    row.record_id,
    row.revision,
  ]);

  useEffect(() => {
    void loadDetail();
  }, [loadDetail]);

  // Load history if not present
  const loadHistory = async () => {
    if (history?.length) return;
    setBusy(true);
    try {
      const data = await api<{ history?: RecordDetailData["history"] }>(
        `/records/${row.record_id}`,
      );
      if (data.history) setHistory(data.history);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al consultar historial",
      );
    } finally {
      setBusy(false);
    }
  };

  // Save changes
  const handleSave = async () => {
    setBusy(true);
    setError("");
    try {
      let parsedGeometry: GeoJSON.Geometry | null = null;
      if (geometryText.trim()) {
        try {
          parsedGeometry = JSON.parse(geometryText.trim()) as GeoJSON.Geometry;
        } catch {
          throw new Error("El formato GeoJSON de la geometría no es válido.");
        }
      }

      const currentRevision = detail?.revision ?? row.revision;

      if (isProjectContext) {
        await api(
          `/projects/${projectId}/records/${row.project_record_id}`,
          {
            expectedRevision: currentRevision,
            attributesOverride: values,
            geometryOverride: parsedGeometry,
          },
          "PATCH",
        );
      } else {
        await api(
          `/records/${row.record_id}`,
          {
            expectedRevision: currentRevision,
            attributes: values,
            geometry: parsedGeometry,
          },
          "PATCH",
        );
      }

      // Invalidate relevant cache
      await localDataCache.invalidateScope(
        row.project_record_id
          ? `project-record:${row.project_record_id}`
          : `record:${row.record_id}`,
      );
      await localDataCache.invalidateCategory("table");
      await localDataCache.invalidateCategory("map");

      onUpdated();
      void loadDetail();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al guardar el registro.",
      );
    } finally {
      setBusy(false);
    }
  };

  // Publish baseline record
  const handlePublish = async () => {
    setBusy(true);
    setError("");
    try {
      const currentRevision = detail?.revision ?? row.revision;
      await api(`/records/${row.record_id}/publish`, {
        expectedRevision: currentRevision,
      });
      await localDataCache.invalidateScope(`record:${row.record_id}`);
      await localDataCache.invalidateCategory("table");
      onUpdated();
      void loadDetail();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al publicar registro",
      );
    } finally {
      setBusy(false);
    }
  };

  // Remove from Project
  const handleRemoveFromProject = async () => {
    if (!confirm("¿Deseas retirar este registro del proyecto actual?")) return;
    setBusy(true);
    setError("");
    try {
      const currentRevision = detail?.revision ?? row.revision;
      await api(
        `/projects/${projectId}/records/${row.project_record_id}`,
        { expectedRevision: currentRevision },
        "DELETE",
      );
      await localDataCache.invalidateCategory("table");
      await localDataCache.invalidateCategory("map");
      onUpdated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al retirar del proyecto.",
      );
    } finally {
      setBusy(false);
    }
  };

  // Incorporate to another project
  const handleIncorporate = async () => {
    if (!targetProject || !targetProjectAppId) return;
    setBusy(true);
    setError("");
    setIncorporateSuccess(false);
    try {
      await api(`/projects/${targetProject}/incorporate`, {
        recordId: row.record_id,
        projectAppId: targetProjectAppId,
      });
      setIncorporateSuccess(true);
      await localDataCache.invalidateCategory("table");
      await localDataCache.invalidateCategory("map");
      onUpdated();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Error al incorporar registro.",
      );
    } finally {
      setBusy(false);
    }
  };

  const candidateProjects = catalog.projects.filter((p) => p.id !== projectId);
  const targetProjectApps = catalog.collections.filter(
    (c) =>
      c.project_id === targetProject &&
      c.app_id === collection?.app_id &&
      c.project_app_id,
  );

  return (
    <aside className="fixed inset-y-0 right-0 z-[1200] w-full sm:w-[460px] bg-white border-l border-slate-200 shadow-2xl flex flex-col font-sans text-slate-800 animate-in slide-in-from-right duration-200">
      {/* Header bar */}
      <div className="h-14 shrink-0 px-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 shrink-0" />
          <div className="truncate">
            <h2 className="text-sm font-semibold tracking-wide truncate">
              {isProjectContext ? "Registro de Proyecto" : "Registro Base"}
            </h2>
            <p className="text-[11px] text-slate-400 truncate">
              ID: {row.record_id.slice(0, 8)} · Rev.{" "}
              {detail?.revision ?? row.revision}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
          aria-label="Cerrar inspector"
        >
          ✕
        </button>
      </div>

      {/* Tabs */}
      <div className="shrink-0 flex border-b border-slate-200 bg-slate-50 px-2 text-xs font-medium">
        <button
          onClick={() => setActiveTab("attributes")}
          className={`px-3 py-2.5 border-b-2 transition ${
            activeTab === "attributes"
              ? "border-sky-600 text-sky-700 bg-white font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Atributos
        </button>
        <button
          onClick={() => setActiveTab("geometry")}
          className={`px-3 py-2.5 border-b-2 transition ${
            activeTab === "geometry"
              ? "border-sky-600 text-sky-700 bg-white font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Geometría
        </button>
        <button
          onClick={() => {
            setActiveTab("context");
            void loadHistory();
          }}
          className={`px-3 py-2.5 border-b-2 transition ${
            activeTab === "context"
              ? "border-sky-600 text-sky-700 bg-white font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          Historial / Contexto
        </button>
      </div>

      {/* Status banner */}
      {error && (
        <div className="p-3 bg-rose-50 text-rose-800 text-xs border-b border-rose-200 flex items-start gap-2">
          <span>⚠️</span>
          <span className="flex-1">{error}</span>
          <button
            onClick={() => setError("")}
            className="text-rose-500 font-bold"
          >
            ×
          </button>
        </div>
      )}

      {loading && (
        <div className="p-4 text-center text-xs text-slate-500">
          Cargando datos del registro…
        </div>
      )}

      {/* Main body */}
      <div className="min-h-0 flex-1 overflow-y-auto p-4 space-y-4">
        {activeTab === "attributes" && (
          <div className="space-y-3">
            {isProjectContext && (
              <div className="p-2.5 bg-sky-50/70 border border-sky-200 rounded text-xs text-sky-900 mb-2">
                <span className="font-semibold">Contexto de Proyecto:</span>{" "}
                Estás editando sobreescrituras contextuales. El registro base no
                se modifica.
              </div>
            )}

            {fields.length > 0 ? (
              fields.map((field) => {
                const value = values[field.id];
                const displayValue =
                  value === null || value === undefined ? "" : String(value);

                return (
                  <div key={field.id} className="space-y-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      {field.label}
                      {field.required && (
                        <span className="text-rose-600 ml-0.5">*</span>
                      )}
                    </label>

                    {field.type === "boolean" ? (
                      <select
                        value={
                          value === true
                            ? "true"
                            : value === false
                              ? "false"
                              : ""
                        }
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [field.id]:
                              e.target.value === ""
                                ? null
                                : e.target.value === "true",
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="">(Sin asignar)</option>
                        <option value="true">Verdadero / Sí</option>
                        <option value="false">Falso / No</option>
                      </select>
                    ) : field.type === "number" ? (
                      <input
                        type="number"
                        value={displayValue}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [field.id]:
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    ) : field.type === "date" ? (
                      <input
                        type="date"
                        value={displayValue}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [field.id]: e.target.value || null,
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    ) : field.type === "longText" ? (
                      <textarea
                        rows={3}
                        value={displayValue}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [field.id]: e.target.value || null,
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    ) : (
                      <input
                        type="text"
                        value={displayValue}
                        onChange={(e) =>
                          setValues({
                            ...values,
                            [field.id]: e.target.value || null,
                          })
                        }
                        className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
                      />
                    )}
                  </div>
                );
              })
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 italic">
                  No hay esquema formal definido. Mostrando atributos
                  detectados:
                </p>
                {Object.entries(values).map(([k, v]) => (
                  <div key={k} className="space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      {k}
                    </label>
                    <input
                      type="text"
                      value={v === null || v === undefined ? "" : String(v)}
                      onChange={(e) =>
                        setValues({
                          ...values,
                          [k]: e.target.value,
                        })
                      }
                      className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "geometry" && (
          <div className="space-y-3">
            <div className="text-xs text-slate-600">
              <p className="font-medium text-slate-800">
                Geometría PostGIS (EPSG:4326)
              </p>
              <p className="text-[11px] text-slate-500">
                Punto, Línea o Polígono en formato GeoJSON.
              </p>
            </div>
            <textarea
              rows={8}
              value={geometryText}
              onChange={(e) => setGeometryText(e.target.value)}
              placeholder='{"type": "Point", "coordinates": [-63.18, -17.78]}'
              className="w-full font-mono text-xs p-2.5 border border-slate-300 rounded bg-slate-50 focus:bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            />
            {detail?.geometry && (
              <div className="p-2.5 bg-slate-100 rounded text-xs space-y-1">
                <p className="font-semibold text-slate-700">
                  Resumen geométrico:
                </p>
                <p className="text-slate-600">Tipo: {detail.geometry.type}</p>
                {"coordinates" in detail.geometry && (
                  <p className="text-slate-600 truncate">
                    Coords: {JSON.stringify(detail.geometry.coordinates)}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "context" && (
          <div className="space-y-4 text-xs">
            {/* Context identity */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
              <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
                Identidades del Registro
              </h3>
              <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
                <span className="text-slate-500">Record UUID:</span>
                <span className="font-mono text-slate-800 truncate">
                  {row.record_id}
                </span>

                <span className="text-slate-500">Dataset ID:</span>
                <span className="font-mono text-slate-800 truncate">
                  {row.dataset_id}
                </span>

                {row.project_record_id && (
                  <>
                    <span className="text-slate-500">ProjectRecord:</span>
                    <span className="font-mono text-slate-800 truncate">
                      {row.project_record_id}
                    </span>
                  </>
                )}

                {row.project_app_id && (
                  <>
                    <span className="text-slate-500">ProjectApp ID:</span>
                    <span className="font-mono text-slate-800 truncate">
                      {row.project_app_id}
                    </span>
                  </>
                )}

                <span className="text-slate-500">Revisión:</span>
                <span className="font-mono text-slate-800">
                  {detail?.revision ?? row.revision}
                </span>
              </div>
            </div>

            {/* Incorporate to other project */}
            <div className="p-3 bg-slate-50 border border-slate-200 rounded space-y-2">
              <h3 className="font-semibold text-slate-800 text-xs">
                Incorporar a otro Proyecto
              </h3>
              <p className="text-[11px] text-slate-500">
                Permite que este registro base participe contextualmente en otro
                proyecto.
              </p>
              <div className="space-y-2">
                <select
                  value={targetProject}
                  onChange={(e) => {
                    setTargetProject(e.target.value);
                    setTargetProjectAppId("");
                  }}
                  className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                >
                  <option value="">Seleccionar Proyecto Destino…</option>
                  {candidateProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>

                {targetProject && (
                  <select
                    value={targetProjectAppId}
                    onChange={(e) => setTargetProjectAppId(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="">
                      Seleccionar App relacionada en el proyecto…
                    </option>
                    {targetProjectApps.map((tpa) => (
                      <option
                        key={tpa.project_app_id}
                        value={tpa.project_app_id!}
                      >
                        {tpa.name} (ProjectApp)
                      </option>
                    ))}
                  </select>
                )}

                <button
                  disabled={busy || !targetProject || !targetProjectAppId}
                  onClick={() => void handleIncorporate()}
                  className="w-full py-1.5 px-3 bg-slate-800 hover:bg-slate-900 disabled:opacity-50 text-white rounded text-xs font-medium transition"
                >
                  Confirmar incorporación
                </button>
                {incorporateSuccess && (
                  <p className="text-[11px] text-emerald-600 font-medium">
                    ✓ Registro incorporado exitosamente al proyecto.
                  </p>
                )}
              </div>
            </div>

            {/* History timeline */}
            <div className="space-y-2">
              <h3 className="font-semibold text-slate-800 text-xs uppercase tracking-wider">
                Línea de tiempo (record_events)
              </h3>
              {history && history.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {history.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-white border border-slate-200 rounded text-[11px] space-y-0.5"
                    >
                      <div className="flex items-center justify-between text-slate-500">
                        <span className="font-semibold uppercase text-sky-800">
                          {item.operation}
                        </span>
                        <span>
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-[11px]">
                  No hay eventos registrados.
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Footer action buttons */}
      <div className="shrink-0 p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isProjectContext ? (
            <button
              disabled={busy}
              onClick={() => void handleRemoveFromProject()}
              className="px-3 py-1.5 text-xs text-rose-700 bg-rose-50 border border-rose-200 hover:bg-rose-100 rounded transition font-medium"
            >
              Retirar de Proyecto
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => void handlePublish()}
              className="px-3 py-1.5 text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition font-medium"
            >
              Publicar
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition"
          >
            Cancelar
          </button>
          <button
            disabled={busy}
            onClick={() => void handleSave()}
            className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded shadow-sm transition"
          >
            {busy ? "Guardando…" : "Guardar cambios"}
          </button>
        </div>
      </div>
    </aside>
  );
}
