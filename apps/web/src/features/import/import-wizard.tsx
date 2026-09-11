"use client";

import { useState } from "react";
import { getApiBase } from "../../lib/api-base";
import type { Collection } from "../operational/contracts";
import { api } from "../operational/contracts";
import { localDataCache } from "../../lib/local-data-cache";

type Inspection = {
  id: string;
  count: number;
  fields: string[];
  statuses: [string, number][];
  crs: string;
};

type Summary = {
  imported: number;
  skipped: number;
  issues: string[];
  confirmed: boolean;
};

const STEPS = [
  { num: 1, label: "Archivo", desc: "Carga de datos GIS" },
  { num: 2, label: "Seleccionar tablas", desc: "Asignación de capas" },
  { num: 3, label: "Georreferencia", desc: "Sistema de coordenadas" },
  { num: 4, label: "Mapear campos", desc: "Correspondencia de atributos" },
  { num: 5, label: "Revisar", desc: "Validación y preview" },
  { num: 6, label: "Resumen", desc: "Confirmación final" },
] as const;

export function ImportWizard({
  collections,
  projectId,
  onComplete,
  onViewRecords,
}: {
  collections: Collection[];
  projectId: string;
  onComplete: () => void;
  onViewRecords?: () => void;
}) {
  const uniqueCollections = collections.filter(
    (c, i, list) => list.findIndex((x) => x.id === c.id) === i,
  );

  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [mappings, setMappings] = useState<
    Record<string, Record<string, string>>
  >({});
  const [previewIssues, setPreviewIssues] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Error durante la importación.",
      );
    } finally {
      setBusy(false);
    }
  };

  const buildRoutesPayload = () => ({
    routes: Object.entries(targets)
      .filter(([, id]) => id)
      .map(([status, id]) => {
        const collection = collections.find((c) => c.id === id)!;
        return {
          datasetId: id,
          ...(projectId ? { projectId } : {}),
          ...(projectId && collection.project_app_id
            ? { projectAppId: collection.project_app_id }
            : {}),
          expectedVersion: collection.version,
          status,
          mapping: Object.fromEntries(
            Object.entries(mappings[status] ?? {}).filter(
              ([, target]) => target,
            ),
          ),
        };
      }),
  });

  // Step 1: Inspect file
  const handleInspect = async () => {
    if (!file) {
      setError("Selecciona un archivo Shapefile ZIP o GeoJSON.");
      return;
    }
    await run(async () => {
      const data = new FormData();
      data.append("file", file);
      const res = await fetch(`${getApiBase()}/api/workspace/imports/inspect`, {
        method: "POST",
        body: data,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.message ?? "No se pudo inspeccionar el archivo.");
      }
      const inspectData = (await res.json()) as Inspection;
      setInspection(inspectData);

      // Pre-select target if only one collection is available
      const initialTargets: Record<string, string> = {};
      const statuses = inspectData.statuses.length
        ? inspectData.statuses
        : [["default", inspectData.count]];
      statuses.forEach(([st]) => {
        if (uniqueCollections.length === 1) {
          initialTargets[st] = uniqueCollections[0].id;
        }
      });
      setTargets(initialTargets);
      setStep(2);
    });
  };

  // Step 5: Preview
  const handlePreview = async () => {
    if (!inspection) return;
    await run(async () => {
      const payload = buildRoutesPayload();
      const res = await api<{ issues?: string[]; validCount?: number }>(
        `/imports/${inspection.id}/preview`,
        payload,
      );
      setPreviewIssues(res.issues ?? []);
      setStep(5);
    });
  };

  // Step 6: Confirm
  const handleConfirm = async () => {
    if (!inspection) return;
    await run(async () => {
      const res = await api<Summary>(`/imports/${inspection.id}/confirm`, {});
      setSummary({ ...res, confirmed: true });
      await localDataCache.invalidateCategory("table");
      await localDataCache.invalidateCategory("map");
      onComplete();
      setStep(6);
    });
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50 font-sans overflow-hidden">
      {/* Step Indicator Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 shrink-0">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          {STEPS.map((s, idx) => (
            <div key={s.num} className="flex items-center">
              <div className="flex items-center gap-2">
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step === s.num
                      ? "bg-sky-600 text-white ring-2 ring-sky-200"
                      : step > s.num
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {step > s.num ? "✓" : s.num}
                </div>
                <div className="hidden sm:block">
                  <p
                    className={`text-xs font-semibold ${
                      step === s.num
                        ? "text-sky-900"
                        : step > s.num
                          ? "text-slate-800"
                          : "text-slate-400"
                    }`}
                  >
                    {s.label}
                  </p>
                </div>
              </div>
              {idx < STEPS.length - 1 && (
                <div
                  className={`h-0.5 w-6 sm:w-12 mx-2 transition ${
                    step > s.num ? "bg-emerald-400" : "bg-slate-200"
                  }`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Error alert */}
      {error && (
        <div className="p-3 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs px-6 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          <button
            onClick={() => setError("")}
            className="font-bold text-rose-500"
          >
            ×
          </button>
        </div>
      )}

      {/* Main wizard content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto bg-white border border-slate-200 rounded-lg shadow-sm p-6">
          {/* STEP 1: Archivo */}
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Carga de Archivo GIS
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Formatos soportados: Shapefile comprimido en (.zip) o GeoJSON
                  (.geojson / .json). Las geometrías deben estar en coordenadas
                  geográficas WGS84 (EPSG:4326).
                </p>
              </div>

              {/* Drag and Drop Zone */}
              <label
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files?.[0])
                    setFile(e.dataTransfer.files[0]);
                }}
                className="border-2 border-dashed border-slate-300 hover:border-sky-500 rounded-lg p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-slate-50/50 hover:bg-sky-50/20 transition"
              >
                <div className="w-12 h-12 rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-2xl">
                  📁
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-700">
                    {file
                      ? file.name
                      : "Haz clic para seleccionar o arrastra un archivo"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {file
                      ? `${(file.size / 1024).toFixed(1)} KB`
                      : "Archivos Shapefile (.zip) o GeoJSON (.json, .geojson)"}
                  </p>
                </div>
                <input
                  type="file"
                  accept=".zip,.geojson,.json"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              {file && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-700">
                      Archivo seleccionado:
                    </span>
                    <span className="text-slate-900 font-medium">
                      {file.name}
                    </span>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-xs text-rose-600 hover:text-rose-700 font-medium"
                  >
                    Eliminar
                  </button>
                </div>
              )}

              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  disabled={!file || busy}
                  onClick={() => void handleInspect()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy ? "Inspeccionando archivo…" : "Inspeccionar archivo →"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: Seleccionar tablas */}
          {step === 2 && inspection && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Asignar Capas a Colecciones
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Se detectaron {inspection.count} registros en el archivo.
                  Asigna cada conjunto o estado a una colección o App de
                  destino.
                </p>
              </div>

              <div className="space-y-4">
                {(inspection.statuses.length
                  ? inspection.statuses
                  : [["default", inspection.count]]
                ).map(([st, cnt]) => (
                  <div
                    key={st}
                    className="p-4 border border-slate-200 rounded-lg bg-slate-50/50 space-y-2"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800">
                        {st === "default"
                          ? "Capa principal del archivo"
                          : `Estado / Capa: ${st}`}
                      </span>
                      <span className="bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[11px]">
                        {cnt} registros
                      </span>
                    </div>

                    <div className="space-y-1">
                      <label className="block text-[11px] font-medium text-slate-600">
                        Colección / App destino:
                      </label>
                      <select
                        value={targets[st] ?? ""}
                        onChange={(e) =>
                          setTargets({
                            ...targets,
                            [st]: e.target.value,
                          })
                        }
                        className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="">Selecciona destino…</option>
                        {uniqueCollections.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name} {c.local_project_id ? "(Local)" : "(App)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  ← Volver
                </button>
                <button
                  disabled={!Object.values(targets).some(Boolean)}
                  onClick={() => setStep(3)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  Continuar a Georreferencia →
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Georreferencia */}
          {step === 3 && inspection && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Verificación de Georreferencia
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Valida el sistema de referencia espacial antes de proceder con
                  el mapeo de atributos.
                </p>
              </div>

              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-700 text-lg">🌍</span>
                  <div>
                    <p className="text-xs font-semibold text-emerald-900">
                      Sistema de Coordenadas Detectado:{" "}
                      {inspection.crs || "EPSG:4326 (WGS84)"}
                    </p>
                    <p className="text-[11px] text-emerald-700">
                      Las geometrías cumplen con el estándar PostGIS EPSG:4326.
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-emerald-100 text-xs text-emerald-800">
                  <div>
                    <span className="text-emerald-600">
                      Total de registros a procesar:
                    </span>{" "}
                    <strong>{inspection.count}</strong>
                  </div>
                  <div>
                    <span className="text-emerald-600">Campos en archivo:</span>{" "}
                    <strong>{inspection.fields.length}</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  ← Volver
                </button>
                <button
                  onClick={() => setStep(4)}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition"
                >
                  Continuar al Mapeo de Campos →
                </button>
              </div>
            </div>
          )}

          {/* STEP 4: Mapear campos */}
          {step === 4 && inspection && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Mapeo de Campos
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Asocia los campos del archivo importado con las columnas del
                  formulario de la colección de destino.
                </p>
              </div>

              <div className="space-y-6">
                {Object.entries(targets)
                  .filter(([, targetId]) => targetId)
                  .map(([st, targetId]) => {
                    const col = uniqueCollections.find(
                      (c) => c.id === targetId,
                    );
                    const schemaFields =
                      col?.schema_definition.sections.flatMap(
                        (s) => s.fields,
                      ) ?? [];

                    return (
                      <div key={st} className="space-y-3">
                        <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                          <h3 className="text-xs font-semibold text-slate-800">
                            Capa: {st} → Destino: {col?.name}
                          </h3>
                        </div>

                        <div className="space-y-2">
                          {inspection.fields.map((sourceField) => (
                            <div
                              key={sourceField}
                              className="grid grid-cols-2 items-center gap-3 p-2 bg-slate-50 rounded border border-slate-200 text-xs"
                            >
                              <div className="truncate font-mono font-medium text-slate-700">
                                {sourceField}
                              </div>
                              <select
                                value={mappings[st]?.[sourceField] ?? ""}
                                onChange={(e) => {
                                  setMappings({
                                    ...mappings,
                                    [st]: {
                                      ...(mappings[st] ?? {}),
                                      [sourceField]: e.target.value,
                                    },
                                  });
                                }}
                                className="w-full text-xs px-2.5 py-1.5 border border-slate-300 rounded bg-white focus:ring-1 focus:ring-sky-500"
                              >
                                <option value="">(Ignorar campo)</option>
                                {schemaFields.map((sf) => (
                                  <option key={sf.id} value={sf.id}>
                                    {sf.label} ({sf.type})
                                  </option>
                                ))}
                              </select>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(3)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  ← Volver
                </button>
                <button
                  disabled={busy}
                  onClick={() => void handlePreview()}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy ? "Validando…" : "Revisar y Validar →"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 5: Revisar */}
          {step === 5 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-base font-semibold text-slate-800">
                  Revisión Previa a la Importación
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Verifica el resumen de la importación antes de aplicar los
                  registros en la base de datos operativa.
                </p>
              </div>

              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-600">
                    Total de registros a importar:
                  </span>
                  <span className="font-semibold text-slate-900">
                    {inspection?.count}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Destinos configurados:</span>
                  <span className="font-semibold text-slate-900">
                    {Object.keys(targets).filter((k) => targets[k]).length}
                  </span>
                </div>
                {previewIssues.length > 0 && (
                  <div className="pt-2 border-t border-slate-200">
                    <p className="font-semibold text-amber-800 mb-1">
                      Advertencias ({previewIssues.length}):
                    </p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700 text-[11px]">
                      {previewIssues.slice(0, 5).map((issue, idx) => (
                        <li key={idx}>{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button
                  onClick={() => setStep(4)}
                  className="px-4 py-2 text-xs text-slate-600 hover:text-slate-800 font-medium"
                >
                  ← Volver a mapeo
                </button>
                <button
                  disabled={busy}
                  onClick={() => void handleConfirm()}
                  className="px-6 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy
                    ? "Confirmando importación…"
                    : "Confirmar Importación Definitiva"}
                </button>
              </div>
            </div>
          )}

          {/* STEP 6: Resumen */}
          {step === 6 && summary && (
            <div className="space-y-6 text-center py-4">
              <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-3xl mx-auto">
                ✓
              </div>

              <div>
                <h2 className="text-lg font-bold text-slate-800">
                  Importación Completada
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Los registros fueron importados exitosamente al dataset
                  operativo.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-sm mx-auto text-xs">
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded">
                  <span className="text-emerald-700 font-bold text-lg block">
                    {summary.imported}
                  </span>
                  <span className="text-emerald-800 font-medium">
                    Registros Importados
                  </span>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded">
                  <span className="text-slate-600 font-bold text-lg block">
                    {summary.skipped}
                  </span>
                  <span className="text-slate-700 font-medium">
                    Registros Omitidos
                  </span>
                </div>
              </div>

              {summary.issues.length > 0 && (
                <div className="text-left p-3 bg-amber-50 border border-amber-200 rounded max-w-md mx-auto text-xs text-amber-800">
                  <p className="font-semibold mb-1">Notas de importación:</p>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px]">
                    {summary.issues.map((msg, i) => (
                      <li key={i}>{msg}</li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="pt-4 flex items-center justify-center gap-3">
                <button
                  onClick={() => {
                    setStep(1);
                    setFile(null);
                    setInspection(null);
                    setSummary(null);
                  }}
                  className="px-4 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition"
                >
                  Importar otro archivo
                </button>
                {onViewRecords && (
                  <button
                    onClick={onViewRecords}
                    className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition"
                  >
                    Ver registros en el mapa →
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
