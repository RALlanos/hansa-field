"use client";

import React, { useState } from "react";
import type { Catalog, Collection } from "../operational/contracts";
import { api } from "../operational/contracts";
import { localDataCache } from "../../lib/local-data-cache";

type Props = {
  catalog: Catalog;
  projectId: string;
  datasetId: string;
  collection?: Collection;
  onClose: () => void;
  onCreated: () => void;
};

export function RecordCreateModal({
  catalog,
  projectId,
  datasetId,
  collection,
  onClose,
  onCreated,
}: Props) {
  const [selectedDatasetId, setSelectedDatasetId] = useState(
    datasetId || (collection?.id ?? ""),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [coordType, setCoordType] = useState<"point" | "geojson">("point");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [geoJsonText, setGeoJsonText] = useState("");

  const activeCollection =
    catalog.collections.find((c) => c.id === selectedDatasetId) ?? collection;

  const fields =
    activeCollection?.schema_definition.sections.flatMap((s) => s.fields) ?? [];

  // Determine available target collections based on context
  const availableCollections = projectId
    ? catalog.collections.filter(
        (c, idx, arr) =>
          c.project_id === projectId &&
          arr.findIndex((x) => x.id === c.id) === idx,
      )
    : catalog.collections.filter(
        (c, idx, arr) =>
          !c.local_project_id && arr.findIndex((x) => x.id === c.id) === idx,
      );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDatasetId) {
      setError("Debes seleccionar una colección / App de destino.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      let geometry: GeoJSON.Geometry | null = null;

      if (coordType === "point") {
        if (lat.trim() && lng.trim()) {
          const latitude = Number(lat);
          const longitude = Number(lng);
          if (isNaN(latitude) || isNaN(longitude)) {
            throw new Error("Latitud o longitud inválida.");
          }
          if (
            latitude < -90 ||
            latitude > 90 ||
            longitude < -180 ||
            longitude > 180
          ) {
            throw new Error(
              "Coordenadas fuera de rango válido (-90 a 90, -180 a 180).",
            );
          }
          geometry = {
            type: "Point",
            coordinates: [longitude, latitude],
          };
        }
      } else if (coordType === "geojson" && geoJsonText.trim()) {
        try {
          geometry = JSON.parse(geoJsonText.trim()) as GeoJSON.Geometry;
        } catch {
          throw new Error("El JSON ingresado no es un GeoJSON válido.");
        }
      }

      // Check if this collection has a projectAppId in the current project
      const targetCol = catalog.collections.find(
        (c) =>
          c.id === selectedDatasetId &&
          (projectId ? c.project_id === projectId : true),
      );

      const resolvedAttributes: Record<string, unknown> = { ...values };
      for (const field of fields) {
        const k = (field as any).key || field.id;
        const v = values[k] !== undefined ? values[k] : values[field.id];
        if (v !== undefined) {
          resolvedAttributes[k] = v;
          resolvedAttributes[field.id] = v;
        }
      }

      const payload: Record<string, unknown> = {
        datasetId: selectedDatasetId,
        attributes: resolvedAttributes,
        geometry,
      };

      if (projectId) {
        payload.projectId = projectId;
        if (targetCol?.project_app_id) {
          payload.projectAppId = targetCol.project_app_id;
        }
      }

      await api("/records", payload);

      // Invalidate table and map cache
      await localDataCache.invalidateCategory("table");
      await localDataCache.invalidateCategory("map");

      onCreated();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo crear el registro.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 font-sans backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="presentation"
    >
      <div
        className="w-full max-w-xl bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-label="Nuevo registro"
      >
        {/* Header */}
        <div className="h-13 px-5 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold tracking-wide">
              Crear Nuevo Registro
            </h2>
            <p className="text-[11px] text-slate-400">
              {projectId
                ? "Registro contextual en Proyecto"
                : "Registro base en App"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 transition"
            aria-label="Cerrar modal"
          >
            ✕
          </button>
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-rose-50 text-rose-800 text-xs border-b border-rose-200 flex items-center gap-2">
            <span>⚠️</span>
            <span className="flex-1">{error}</span>
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto p-5 space-y-4"
        >
          {/* Collection selection */}
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700">
              Colección / Capa Destino <span className="text-rose-600">*</span>
            </label>
            <select
              required
              value={selectedDatasetId}
              onChange={(e) => {
                setSelectedDatasetId(e.target.value);
                setValues({});
              }}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:outline-none focus:ring-1 focus:ring-sky-500"
            >
              <option value="">Selecciona una colección…</option>
              {availableCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.local_project_id ? "(Colección local)" : "(App)"}
                </option>
              ))}
            </select>
          </div>

          {/* Form attributes */}
          {activeCollection && (
            <div className="space-y-3 pt-2 border-t border-slate-100">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Atributos del Formulario
              </h3>

              {fields.length > 0 ? (
                fields.map((field) => {
                  const fieldKey = (field as any).key || field.id;
                  const val =
                    values[fieldKey] !== undefined
                      ? values[fieldKey]
                      : values[field.id];
                  const strVal =
                    val === null || val === undefined ? "" : String(val);

                  const handleValueChange = (newVal: unknown) => {
                    setValues((prev) => ({
                      ...prev,
                      [fieldKey]: newVal,
                      ...(fieldKey !== field.id ? { [field.id]: newVal } : {}),
                    }));
                  };

                  const options = (field as any).options as string[] | undefined;

                  return (
                    <div key={field.id} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="block text-xs font-medium text-slate-700">
                          {field.label}
                          {field.required && (
                            <span className="text-rose-600 ml-0.5">*</span>
                          )}
                        </label>
                        <span className="text-[10px] font-mono text-slate-400">
                          {fieldKey}
                        </span>
                      </div>

                      {field.type === "singleChoice" || (options && options.length > 0) ? (
                        <select
                          required={field.required}
                          value={strVal}
                          onChange={(e) =>
                            handleValueChange(e.target.value || null)
                          }
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded bg-white font-medium text-slate-800"
                        >
                          <option value="">(Seleccionar opción)</option>
                          {(options || []).map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                      ) : field.type === "boolean" ? (
                        <select
                          required={field.required}
                          value={
                            val === true ? "true" : val === false ? "false" : ""
                          }
                          onChange={(e) =>
                            handleValueChange(
                              e.target.value === ""
                                ? null
                                : e.target.value === "true",
                            )
                          }
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
                        >
                          <option value="">(Seleccionar)</option>
                          <option value="true">Sí / Verdadero</option>
                          <option value="false">No / Falso</option>
                        </select>
                      ) : field.type === "number" ? (
                        <input
                          type="number"
                          required={field.required}
                          value={strVal}
                          onChange={(e) =>
                            handleValueChange(
                              e.target.value === ""
                                ? null
                                : Number(e.target.value),
                            )
                          }
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
                        />
                      ) : field.type === "date" ? (
                        <input
                          type="date"
                          required={field.required}
                          value={strVal}
                          onChange={(e) =>
                            handleValueChange(e.target.value || null)
                          }
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
                        />
                      ) : field.type === "longText" ? (
                        <textarea
                          rows={2}
                          required={field.required}
                          value={strVal}
                          onChange={(e) =>
                            handleValueChange(e.target.value || null)
                          }
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
                        />
                      ) : (
                        <input
                          type="text"
                          required={field.required}
                          value={strVal}
                          onChange={(e) =>
                            handleValueChange(e.target.value || null)
                          }
                          className="w-full text-xs px-3 py-1.5 border border-slate-300 rounded bg-white"
                        />
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500 italic">
                    Sin campos predefinidos. Puedes agregar un atributo
                    genérico:
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Nombre del campo"
                      id="custom_field_name"
                      className="text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                    <input
                      type="text"
                      placeholder="Valor"
                      id="custom_field_value"
                      className="text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Geometry section */}
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Geometría (Opcional · EPSG:4326)
              </h3>
              <div className="flex gap-1 text-[11px] bg-slate-100 p-0.5 rounded">
                <button
                  type="button"
                  onClick={() => setCoordType("point")}
                  className={`px-2 py-0.5 rounded ${
                    coordType === "point"
                      ? "bg-white font-semibold text-slate-800 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  Punto Lat/Lng
                </button>
                <button
                  type="button"
                  onClick={() => setCoordType("geojson")}
                  className={`px-2 py-0.5 rounded ${
                    coordType === "geojson"
                      ? "bg-white font-semibold text-slate-800 shadow-xs"
                      : "text-slate-600"
                  }`}
                >
                  GeoJSON
                </button>
              </div>
            </div>

            {coordType === "point" ? (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Latitud (ej: -17.78)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lat}
                    onChange={(e) => setLat(e.target.value)}
                    placeholder="-17.7833"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="block text-[11px] font-medium text-slate-600">
                    Longitud (ej: -63.18)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={lng}
                    onChange={(e) => setLng(e.target.value)}
                    placeholder="-63.1821"
                    className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded"
                  />
                </div>
              </div>
            ) : (
              <textarea
                rows={3}
                value={geoJsonText}
                onChange={(e) => setGeoJsonText(e.target.value)}
                placeholder='{"type":"Point","coordinates":[-63.18,-17.78]}'
                className="w-full font-mono text-xs p-2.5 border border-slate-300 rounded bg-slate-50 focus:bg-white"
              />
            )}
          </div>

          {/* Footer actions */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded transition"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy || !selectedDatasetId}
              className="px-4 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-50 rounded shadow-sm transition"
            >
              {busy ? "Creando…" : "Crear Registro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
