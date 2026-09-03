"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { FeatureCollection, Point } from "geojson";

import {
  initialFieldMappings,
  initialTableMappings,
} from "./shapefile-import-model";
import { ShapefilePreviewMap } from "./shapefile-preview-map";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
const steps = [
  "Archivo",
  "Seleccionar tablas",
  "Georreferencia",
  "Mapear campos",
  "Revisar",
  "Resumen",
] as const;

type App = {
  id: string;
  code: string;
  name: string;
  fields: Array<{ key: string; label: string; type: string }>;
};
type Project = { id: string; code: string; name: string };
type Inspection = {
  jobId: string;
  featureCount: number;
  geometryType: "Point";
  sourceFileName: string;
  layerName: string;
  crs: { name: string; epsg: number; wkt: string };
  preview: FeatureCollection<Point>;
  tables: Array<{
    sourceStatus: string;
    count: number;
    suggestedAppId: string | null;
    suggestedAppCode: string | null;
  }>;
  fields: Array<{
    sourceName: string;
    suggestedKey: string;
    suggestedType: string;
    presentCount: number;
  }>;
  availableApps: App[];
};
type Plan = {
  total: number;
  creates: number;
  updates: number;
  skipped: number;
  errors: Array<{ index?: number; message: string }>;
  apps: Array<{ id: string; code: string; name: string; count: number }>;
};
type Result = Plan & { created: number; updated: number; failed: number };

export function ShapefileImportWorkspace() {
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState<"standalone" | "project" | "app">(
    "standalone",
  );
  const [targetId, setTargetId] = useState("");
  const [apps, setApps] = useState<App[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [tableMappings, setTableMappings] = useState<
    Record<string, string | null>
  >({});
  const [fieldMappings, setFieldMappings] = useState<
    Record<string, Record<string, string | null>>
  >({});
  const [activeAppId, setActiveAppId] = useState("");
  const [crsConfirmed, setCrsConfirmed] = useState(false);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    void Promise.all([
      fetch(`${apiUrl}/api/apps`).then((response) => response.json()),
      fetch(`${apiUrl}/api/projects`).then((response) => response.json()),
    ])
      .then(([appResponse, projectResponse]) => {
        setApps((appResponse as { data: App[] }).data);
        setProjects((projectResponse as { data: Project[] }).data);
      })
      .catch(() => setError("No se pudieron cargar Apps y proyectos."));
  }, []);

  const selectedAppIds = useMemo(
    () => [
      ...new Set(
        Object.values(tableMappings).filter((value): value is string =>
          Boolean(value),
        ),
      ),
    ],
    [tableMappings],
  );
  const selectedApps = useMemo(
    () =>
      (inspection?.availableApps ?? apps).filter((app) =>
        selectedAppIds.includes(app.id),
      ),
    [apps, inspection, selectedAppIds],
  );
  const activeApp =
    selectedApps.find((app) => app.id === activeAppId) ?? selectedApps[0];

  async function upload() {
    if (!file || (scope !== "standalone" && !targetId)) return;
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const query = new URLSearchParams({ scope });
      if (scope !== "standalone") query.set("targetId", targetId);
      const response = await fetch(
        `${apiUrl}/api/imports/shapefile/inspect?${query}`,
        {
          method: "POST",
          body: form,
        },
      );
      const body = (await response.json()) as Inspection & { message?: string };
      if (!response.ok)
        throw new Error(body.message ?? "No se pudo inspeccionar el ZIP.");
      setInspection(body);
      const tables = initialTableMappings(body.tables);
      setTableMappings(tables);
      setFieldMappings(initialFieldMappings(body.fields, body.availableApps));
      setActiveAppId(
        Object.values(tables).find((value): value is string =>
          Boolean(value),
        ) ?? "",
      );
      setStep(2);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo inspeccionar el ZIP.",
      );
    } finally {
      setBusy(false);
    }
  }

  function selectionBody() {
    return {
      georeferenceConfirmed: true as const,
      tableMappings: Object.entries(tableMappings).map(
        ([sourceStatus, targetAppId]) => ({
          sourceStatus,
          targetAppId,
        }),
      ),
      fieldMappings: selectedApps.flatMap((app) =>
        Object.entries(fieldMappings[app.id] ?? {}).map(
          ([sourceField, targetFieldKey]) => ({
            targetAppId: app.id,
            sourceField,
            targetFieldKey,
          }),
        ),
      ),
    };
  }

  async function review() {
    if (!inspection) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/api/imports/shapefile/${inspection.jobId}/plan`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(selectionBody()),
        },
      );
      const body = (await response.json()) as Plan & { message?: string };
      if (!response.ok)
        throw new Error(body.message ?? "No se pudo preparar la importación.");
      setPlan(body);
      setStep(5);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo preparar la importación.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm() {
    if (!inspection || !plan || plan.errors.length) return;
    setBusy(true);
    setError("");
    try {
      const response = await fetch(
        `${apiUrl}/api/imports/shapefile/${inspection.jobId}/confirm`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ ...selectionBody(), confirm: true }),
        },
      );
      const body = (await response.json()) as Result & { message?: string };
      if (!response.ok)
        throw new Error(body.message ?? "No se pudo ejecutar la importación.");
      setResult(body);
      setStep(6);
    } catch (reason: unknown) {
      setError(
        reason instanceof Error
          ? reason.message
          : "No se pudo ejecutar la importación.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="import-page">
      <header className="import-header">
        <div>
          <p className="eyebrow">Importaciones GIS</p>
          <h1>Nueva importación</h1>
        </div>
        <div className="import-actions">
          {step > 1 && step < 6 && (
            <button
              className="secondary-button"
              onClick={() => setStep(step - 1)}
              type="button"
            >
              Atrás
            </button>
          )}
          {step === 2 && (
            <button
              className="primary-button"
              disabled={!selectedAppIds.length}
              onClick={() => setStep(3)}
              type="button"
            >
              Siguiente
            </button>
          )}
          {step === 3 && (
            <button
              className="primary-button"
              disabled={!crsConfirmed}
              onClick={() => setStep(4)}
              type="button"
            >
              Siguiente
            </button>
          )}
          {step === 4 && (
            <button
              className="primary-button"
              disabled={busy}
              onClick={review}
              type="button"
            >
              Revisar
            </button>
          )}
          {step === 5 && (
            <button
              className="primary-button"
              disabled={busy || !plan || Boolean(plan.errors.length)}
              onClick={confirm}
              type="button"
            >
              Importar
            </button>
          )}
        </div>
      </header>

      <ol className="import-steps" aria-label="Progreso de importación">
        {steps.map((label, index) => (
          <li
            className={
              step === index + 1
                ? "is-current"
                : step > index + 1
                  ? "is-done"
                  : ""
            }
            key={label}
          >
            <span>{index + 1}</span>
            {label}
          </li>
        ))}
      </ol>
      {error && <output className="import-error">{error}</output>}

      {step === 1 && (
        <section className="import-sheet import-upload-grid">
          <label>
            Contexto
            <select
              value={scope}
              onChange={(event) => {
                setScope(event.target.value as typeof scope);
                setTargetId("");
              }}
            >
              <option value="standalone">Sin proyecto ni App</option>
              <option value="project">Proyecto existente</option>
              <option value="app">App existente</option>
            </select>
          </label>
          {scope === "project" && (
            <label>
              Proyecto
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">Seleccionar proyecto…</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {scope === "app" && (
            <label>
              App
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
              >
                <option value="">Seleccionar App…</option>
                {apps.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label className="file-drop">
            <strong>{file?.name ?? "Seleccionar Shapefile ZIP"}</strong>
            <span>SHP + SHX + DBF + PRJ · máximo 50 MB</span>
            <input
              accept=".zip,application/zip"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              type="file"
            />
          </label>
          <button
            className="primary-button"
            disabled={!file || busy || (scope !== "standalone" && !targetId)}
            onClick={upload}
            type="button"
          >
            {busy ? "Inspeccionando…" : "Inspeccionar archivo"}
          </button>
        </section>
      )}

      {step === 2 && inspection && (
        <section className="import-sheet">
          <div className="import-section-heading">
            <div>
              <h2>Seleccionar tablas</h2>
              <p>
                Asocia cada valor de _status con una App existente o no lo
                importes.
              </p>
            </div>
            <strong>
              {inspection.featureCount.toLocaleString("es-BO")} registros
            </strong>
          </div>
          <div className="mapping-table table-mapping">
            <div className="mapping-head">
              <span>Tabla detectada</span>
              <span>Registros</span>
              <span>App existente</span>
            </div>
            {inspection.tables.map((table) => (
              <div className="mapping-row" key={table.sourceStatus}>
                <strong>{table.sourceStatus}</strong>
                <span>{table.count.toLocaleString("es-BO")}</span>
                <select
                  value={tableMappings[table.sourceStatus] ?? ""}
                  onChange={(event) =>
                    setTableMappings((current) => ({
                      ...current,
                      [table.sourceStatus]: event.target.value || null,
                    }))
                  }
                >
                  <option value="">No importar</option>
                  {inspection.availableApps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name} · {app.code}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </section>
      )}

      {step === 3 && inspection && (
        <section className="import-sheet georeference-grid">
          <div>
            <h2>Georreferencia</h2>
            <dl>
              <dt>Geometría</dt>
              <dd>{inspection.geometryType}</dd>
              <dt>CRS detectado</dt>
              <dd>
                {inspection.crs.name} · EPSG:{inspection.crs.epsg}
              </dd>
              <dt>Capa</dt>
              <dd>{inspection.layerName}</dd>
            </dl>
            <label className="confirmation-check">
              <input
                checked={crsConfirmed}
                onChange={(event) => setCrsConfirmed(event.target.checked)}
                type="checkbox"
              />{" "}
              Confirmo el CRS y la ubicación mostrada.
            </label>
          </div>
          <ShapefilePreviewMap collection={inspection.preview} />
        </section>
      )}

      {step === 4 && inspection && activeApp && (
        <section className="import-sheet">
          <div className="import-section-heading">
            <div>
              <h2>Mapear campos</h2>
              <p>
                Cada columna debe apuntar a un campo existente o quedar en “No
                importar”.
              </p>
            </div>
          </div>
          <nav className="mapping-tabs" aria-label="Apps seleccionadas">
            {selectedApps.map((app) => (
              <button
                className={activeApp.id === app.id ? "is-active" : ""}
                key={app.id}
                onClick={() => setActiveAppId(app.id)}
                type="button"
              >
                {app.name}
              </button>
            ))}
          </nav>
          <div className="mapping-table field-mapping">
            <div className="mapping-head">
              <span>Importar</span>
              <span>Columna fuente</span>
              <span>Campo destino en {activeApp.name}</span>
              <span>Tipo detectado</span>
            </div>
            {inspection.fields.map((field) => {
              const target =
                fieldMappings[activeApp.id]?.[field.sourceName] ?? null;
              return (
                <div className="mapping-row" key={field.sourceName}>
                  <input
                    checked={Boolean(target)}
                    onChange={(event) =>
                      setFieldMappings((current) => ({
                        ...current,
                        [activeApp.id]: {
                          ...current[activeApp.id],
                          [field.sourceName]:
                            event.target.checked &&
                            activeApp.fields.some(
                              (target) => target.key === field.suggestedKey,
                            )
                              ? field.suggestedKey
                              : null,
                        },
                      }))
                    }
                    type="checkbox"
                  />
                  <strong>{field.sourceName}</strong>
                  <select
                    value={target ?? ""}
                    onChange={(event) =>
                      setFieldMappings((current) => ({
                        ...current,
                        [activeApp.id]: {
                          ...current[activeApp.id],
                          [field.sourceName]: event.target.value || null,
                        },
                      }))
                    }
                  >
                    <option value="">No importar</option>
                    {activeApp.fields.map((target) => (
                      <option key={target.key} value={target.key}>
                        {target.label} · {target.type}
                      </option>
                    ))}
                  </select>
                  <span>{field.suggestedType}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {step === 5 && plan && (
        <section className="import-sheet review-sheet">
          <h2>Revisar incidencias</h2>
          <div className="import-totals">
            <span>
              <strong>{plan.total}</strong>Importar
            </span>
            <span>
              <strong>{plan.creates}</strong>Nuevos
            </span>
            <span>
              <strong>{plan.updates}</strong>Actualizar
            </span>
            <span>
              <strong>{plan.skipped}</strong>Omitidos
            </span>
          </div>
          {plan.errors.length ? (
            <ul>
              {plan.errors.map((item, index) => (
                <li key={`${index}-${item.message}`}>
                  {item.index === undefined
                    ? ""
                    : `Registro ${item.index + 1}: `}
                  {item.message}
                </li>
              ))}
            </ul>
          ) : (
            <p className="import-ready">
              Sin incidencias. La importación todavía no modificó datos.
            </p>
          )}
        </section>
      )}

      {step === 6 && result && (
        <section className="import-sheet result-sheet">
          <h2>Importación terminada</h2>
          <p>
            {result.created.toLocaleString("es-BO")} creados ·{" "}
            {result.updated.toLocaleString("es-BO")} actualizados ·{" "}
            {result.skipped.toLocaleString("es-BO")} omitidos.
          </p>
          <div className="result-apps">
            {result.apps.map((app) => (
              <Link href={`/apps/${app.id}/records`} key={app.id}>
                {app.code}
                <span>{app.count.toLocaleString("es-BO")} registros →</span>
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
