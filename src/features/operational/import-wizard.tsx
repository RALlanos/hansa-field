"use client";
import { getApiBase } from "../../lib/api-base";
import { useState } from "react";
import { api, type Collection } from "./contracts";
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
  "Archivo",
  "Seleccionar tablas",
  "Georreferencia",
  "Mapear campos",
  "Revisar",
  "Resumen",
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
  key?: string | number;
}) {
  const uniqueCollections = collections.filter(
    (c, i, list) => list.findIndex((x) => x.id === c.id) === i,
  );
  const [step, setStep] = useState(1),
    [file, setFile] = useState<File | null>(null),
    [inspection, setInspection] = useState<Inspection | null>(null),
    [targets, setTargets] = useState<Record<string, string>>({}),
    [mappings, setMappings] = useState<Record<string, Record<string, string>>>(
      {},
    ),
    [summary, setSummary] = useState<Summary | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [projectIdLocal, setProjectIdLocal] = useState(""),
    [datasetIdLocal, setDatasetIdLocal] = useState(""),
    [cursorLocal, setCursorLocal] = useState("");
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  const routes = () => ({
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
  const primaryLabel =
    step === 1
      ? "Inspeccionar archivo"
      : step === 2 || step === 3
        ? "Siguiente"
        : step === 4
          ? "Revisar"
          : step === 5
            ? "Confirmar importación"
            : "Finalizar";
  const infoText =
    step === 1
      ? "Selecciona el destino y carga un archivo para comenzar."
      : step === 2
        ? "Asigna cada tabla o estado del archivo a una App o colección destino."
        : step === 3
          ? "Revisa el sistema de coordenadas detectado antes de continuar."
          : step === 4
            ? "Vincula las columnas del archivo con los campos del formulario."
            : step === 5
              ? "Revisa el resumen antes de confirmar la importación."
              : "Importación completada. Los registros están guardados.";
  return (
    <section className="import-screen">
      <header className="import-top-bar">
        <div className="import-top-bar-left">
          <h1>Importar</h1>
        </div>
        <div className="import-top-bar-center">
          <label>
            Contexto
            <select
              value={projectIdLocal}
              onChange={(e) => {
                setProjectIdLocal(e.target.value);
                setDatasetIdLocal("");
                setCursorLocal("");
              }}
            >
              <option value="">App independiente</option>
              <option value={projectId || ""} disabled>
                {projectId || "Sin contexto"}
              </option>
            </select>
          </label>
          <label>
            App / colección
            <select
              value={datasetIdLocal}
              onChange={(e) => {
                setDatasetIdLocal(e.target.value);
                setCursorLocal("");
              }}
            >
              <option value="">
                {projectId ? "Todas las colecciones" : "Seleccionar App"}
              </option>
              {uniqueCollections.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="import-top-bar-right">
          <button
            className="button-primary"
            disabled={busy || step !== 1}
            onClick={() =>
              void run(async () => {
                const form = new FormData();
                form.append("file", file!);
                const response = await fetch(
                  `${getApiBase()}/api/workspace/imports/inspect`,
                  { method: "POST", body: form },
                );
                const data = await response.json();
                if (!response.ok) throw new Error(data.message);
                setInspection(data);
                setStep(2);
              })
            }
          >
            {step === 1 ? "Inspeccionar archivo" : primaryLabel}
          </button>
        </div>
      </header>

      <nav className="import-steps" aria-label="Pasos de importación">
        {STEPS.map((label, i) => {
          const number = i + 1;
          const state =
            step === number
              ? "active"
              : step > number
                ? "done"
                : "pending";
          return (
            <div
              className={`import-step is-${state} import-step-${state}`}
              key={label}
            >
              <span className="import-step-badge">{number}</span>
              <span className="import-step-label">{label}</span>
            </div>
          );
        })}
      </nav>

      <div className="import-info-banner">
        {infoText}
      </div>

      <div className="import-panel">
        {step === 1 && (
          <div className="import-step-file">
            <div className="import-cols">
              <div className="import-col import-col-contexto">
                <h3>Contexto</h3>
                <p className="import-col-hint">
                  Define si la importación irá a una App independiente o a una
                  colección/proyecto.
                </p>
                <p className="import-col-value">
                  {projectId
                    ? collections.find(
                        (c) => c.project_id === projectId || c.local_project_id === projectId,
                      )?.name ?? "Proyecto seleccionado"
                    : "App independiente"}
                </p>
              </div>

              <div className="import-col import-col-modo">
                <h3>Modo de importación</h3>
                <p className="import-col-hint">
                  La estrategia de actualización se definirá en pasos posteriores.
                </p>
                <div className="import-mode-card">
                  <strong>Crear nuevos registros</strong>
                  <span>
                    La importación utilizará el flujo configurado actualmente.
                  </span>
                </div>
              </div>

              <div className="import-col import-col-archivo">
                <h3>Seleccionar archivo</h3>
                <div className="import-file-zone">
                  <input
                    aria-label="Archivo GIS"
                    type="file"
                    accept=".zip,.geojson,.json"
                    id="import-file-input"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  <label className="import-file-pick" htmlFor="import-file-input">
                    Elegir archivo
                  </label>
                  <span className="import-file-name">
                    {file ? file.name : "Ningún archivo seleccionado"}
                  </span>
                </div>
                <p className="import-col-hint">
                  Formatos permitidos: SHP + SHX + DBF + PRJ en ZIP, o GeoJSON.
                  Máximo 20.000 registros por archivo.
                </p>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="import-step-tables">
            {inspection?.statuses.map(([status, count]) => (
              <label className="import-table-route" key={status}>
                <span className="import-table-route-name">
                  {status || "Sin status"}
                </span>
                <span className="import-table-route-count">{count}</span>
                <select
                  value={targets[status] ?? ""}
                  onChange={(e) => {
                    const id = e.target.value;
                    setTargets({ ...targets, [status]: id });
                    const fields =
                      collections
                        .find((c) => c.id === id)
                        ?.schema_definition.sections.flatMap((s) => s.fields) ??
                      [];
                    setMappings({
                      ...mappings,
                      [status]: Object.fromEntries(
                        inspection.fields.map((source) => [
                          source,
                          fields.find(
                            (f) =>
                              f.key.toLowerCase() === source.toLowerCase() ||
                              f.label.toLowerCase() === source.toLowerCase(),
                          )?.id ?? "",
                        ]),
                      ),
                    });
                  }}
                >
                  <option value="">Omitir</option>
                  {collections.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        )}

        {step === 3 && (
          <div className="import-step-crs">
            <h3>Georreferencia</h3>
            <p>
              CRS detectado: <strong>{inspection?.crs}</strong>. Las coordenadas
              se validan antes de escribir en PostGIS.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="import-step-mapping">
            {Object.entries(targets)
              .filter(([, id]) => id)
              .map(([status, id]) => (
                <fieldset className="import-mapping-group" key={status}>
                  <legend>
                    {status || "Sin status"} →{" "}
                    {collections.find((c) => c.id === id)?.name}
                  </legend>
                  {inspection?.fields.map((source) => (
                    <label className="import-mapping-field" key={source}>
                      <span>{source}</span>
                      <select
                        value={mappings[status]?.[source] ?? ""}
                        onChange={(e) =>
                          setMappings({
                            ...mappings,
                            [status]: {
                              ...mappings[status],
                              [source]: e.target.value,
                            },
                          })
                        }
                      >
                        <option value="">Omitir columna</option>
                        {collections
                          .find((c) => c.id === id)
                          ?.schema_definition.sections.flatMap((s) => s.fields)
                          .map((f) => (
                            <option value={f.id} key={f.id}>
                              {f.label} ({f.key})
                            </option>
                          ))}
                      </select>
                    </label>
                  ))}
                </fieldset>
              ))}
          </div>
        )}

        {step >= 5 && summary && (
          <div className="import-step-summary">
            <p>
              {summary.imported} para importar · {summary.skipped} omitidos
            </p>
            {summary.issues.map((issue) => (
              <p key={issue} role="alert">
                {issue}
              </p>
            ))}
            {step === 6 && (
              <p>Importación confirmada. Los registros están guardados.</p>
            )}
          </div>
        )}
      </div>

      <footer className="import-footer">
        {step > 1 && step < 6 && (
          <button className="button-secondary" disabled={busy} onClick={() => setStep(step - 1)}>
            Atrás
          </button>
        )}
        {step >= 2 && step < 4 && (
          <button
            className="button-primary"
            disabled={busy || !Object.values(targets).some(Boolean)}
            onClick={() => setStep(step + 1)}
          >
            {primaryLabel}
          </button>
        )}
        {step === 4 && (
          <button
            className="button-primary"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setSummary(
                  await api<Summary>(
                    `/imports/${inspection!.id}/preview`,
                    routes(),
                  ),
                );
                setStep(5);
              })
            }
          >
            Revisar
          </button>
        )}
        {step === 5 && (
          <button
            className="button-primary"
            disabled={busy || !!summary?.issues.length}
            onClick={() =>
              void run(async () => {
                setSummary(
                  await api<Summary>(
                    `/imports/${inspection!.id}/confirm`,
                    routes(),
                  ),
                );
                setStep(6);
                onComplete();
              })
            }
          >
            {busy ? "Importando…" : "Confirmar importación"}
          </button>
        )}
      </footer>
    </section>
  );
}