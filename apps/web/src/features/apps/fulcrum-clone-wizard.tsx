"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { getApiBase } from "../../lib/api-base";
import type { Catalog } from "../operational/contracts";

type SourceForm = { id: string; name: string; recordCount: number | null };
type Choice = { value: string; label: string; color: string | null };
type PreviewField = {
  key: string;
  label: string;
  type: string;
  choices: Choice[];
  required: boolean;
  isStatus: boolean;
};
type Preview = {
  id: string;
  name: string;
  description: string;
  geometryTypes: string[];
  sections: { key: string; label: string; fieldCount: number }[];
  fields: PreviewField[];
  statusFieldKey: string | null;
};

type Props = Readonly<{
  catalog: Catalog;
  onComplete: () => Promise<void>;
  onClose: () => void;
}>;

async function fulcrumRequest<T>(
  path: string,
  temporaryToken: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${getApiBase()}/api/workspace${path}`, {
    ...(body === undefined
      ? {}
      : { method: "POST", body: JSON.stringify(body) }),
    headers: {
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(temporaryToken ? { "x-fulcrum-token": temporaryToken } : {}),
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      typeof payload === "object" && payload !== null && "message" in payload
        ? String(payload.message)
        : "No se pudo conectar con Fulcrum.",
    );
  return payload as T;
}

export function FulcrumCloneWizard({ catalog, onComplete, onClose }: Props) {
  const [forms, setForms] = useState<SourceForm[]>([]);
  const [formId, setFormId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [strategy, setStrategy] = useState<
    "preserve" | "sections" | "fieldValues"
  >("preserve");
  const [recordsMode, setRecordsMode] = useState<"structure" | "records">(
    "structure",
  );
  const [splitFieldKey, setSplitFieldKey] = useState("");
  const [projectMode, setProjectMode] = useState<"none" | "existing" | "new">(
    "none",
  );
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [temporaryToken, setTemporaryToken] = useState("");
  const [activeToken, setActiveToken] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [importIssues, setImportIssues] = useState<string[]>([]);

  const loadForms = useCallback(async (token: string) => {
    setLoading(true);
    setMessage("");
    try {
      const items = await fulcrumRequest<SourceForm[]>("/fulcrum/forms", token);
      setForms(items);
      return true;
    } catch (reason: unknown) {
      setForms([]);
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudo conectar con Fulcrum.",
      );
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadForms("");
  }, [loadForms]);

  useEffect(() => {
    if (!formId) {
      setPreview(null);
      return;
    }
    let active = true;
    setPreview(null);
    setMessage("");
    fulcrumRequest<Preview>(`/fulcrum/forms/${formId}`, activeToken)
      .then((data) => {
        if (!active) return;
        setPreview(data);
        setSplitFieldKey(data.statusFieldKey ?? "");
      })
      .catch((reason: unknown) => {
        if (active)
          setMessage(
            reason instanceof Error
              ? reason.message
              : "No se pudo inspeccionar la App.",
          );
      });
    return () => {
      active = false;
    };
  }, [activeToken, formId]);

  const splitCandidates = useMemo(
    () => preview?.fields.filter((field) => field.choices.length > 0) ?? [],
    [preview],
  );
  const selectedSplit = splitCandidates.find(
    (field) => field.key === splitFieldKey,
  );
  const canSubmit = Boolean(
    preview &&
    (strategy !== "fieldValues" || selectedSplit) &&
    (projectMode !== "existing" || projectId) &&
    (projectMode !== "new" || projectName.trim()),
  );

  async function submit() {
    if (!canSubmit || !preview) return;
    setSubmitting(true);
    setMessage("");
    setImportIssues([]);
    try {
      const result = await fulcrumRequest<{
        apps: { id: string; name: string; created: boolean }[];
        projectId: string | null;
        recordsImported: number;
        recordsUpdated: number;
        recordsSkipped: number;
        issues: string[];
      }>("/fulcrum/clone", activeToken, {
        formId: preview.id,
        strategy,
        recordsMode,
        ...(strategy === "fieldValues" ? { splitFieldKey } : {}),
        ...(projectMode === "existing" ? { projectId } : {}),
        ...(projectMode === "new" ? { projectName: projectName.trim() } : {}),
      });
      await onComplete();
      setImportIssues(result.issues);
      setMessage(
        recordsMode === "records"
          ? `${result.apps.length} App(s) preparadas. Registros: ${result.recordsImported} nuevos, ${result.recordsUpdated} actualizados y ${result.recordsSkipped} omitidos.${result.issues.length ? " Revisa las incidencias mostradas." : ""}`
          : `${result.apps.length} App(s) ${result.apps.every((app) => !app.created) ? "ya existían" : "creada(s)"}${result.projectId ? " y vinculada(s) al Proyecto" : ""}. No se importaron registros.`,
      );
    } catch (reason: unknown) {
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudo crear la estructura.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section
      className="bg-white border border-sky-200 rounded-lg shadow-sm overflow-hidden"
      aria-labelledby="fulcrum-clone-title"
    >
      <header className="px-5 py-4 bg-sky-50 border-b border-sky-100 flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold tracking-wider text-sky-700 uppercase">
            Conexión de origen
          </p>
          <h2
            id="fulcrum-clone-title"
            className="text-sm font-semibold text-slate-900"
          >
            Clonar configuración desde Fulcrum
          </h2>
          <p className="text-xs text-slate-600 mt-1">
            Crea Plantilla, App y Dataset vacíos en Hansa. No lee ni mueve
            registros.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-slate-600 hover:text-slate-950"
        >
          Cerrar
        </button>
      </header>
      <div className="p-5 space-y-5">
        <div className="p-3 border border-slate-200 rounded bg-slate-50 space-y-2">
          <label className="block text-xs font-medium text-slate-700 space-y-1">
            <span>Token temporal de Fulcrum</span>
            <input
              type="password"
              value={temporaryToken}
              onChange={(event) => setTemporaryToken(event.target.value)}
              autoComplete="off"
              spellCheck={false}
              placeholder="Pega aquí tu token de Fulcrum"
              className="w-full max-w-xl px-3 py-2 bg-white border border-slate-300 rounded"
            />
          </label>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={!temporaryToken.trim() || loading}
              onClick={() => {
                const token = temporaryToken.trim();
                void loadForms(token).then((connected) => {
                  if (!connected) return;
                  setActiveToken(token);
                  setFormId("");
                  setPreview(null);
                  setMessage("Fulcrum conectado para esta sesión.");
                });
              }}
              className="px-3 py-2 text-xs font-semibold text-white bg-sky-600 disabled:opacity-50 rounded"
            >
              Conectar Fulcrum
            </button>
            <p className="text-[11px] text-slate-500">
              Se usa solo en memoria para esta ventana y no se guarda en Hansa.
            </p>
          </div>
        </div>
        {loading ? (
          <p className="text-xs text-slate-500">
            Consultando Apps disponibles…
          </p>
        ) : (
          <label className="block text-xs font-medium text-slate-700 space-y-1">
            <span>App de Fulcrum</span>
            <select
              value={formId}
              onChange={(event) => setFormId(event.target.value)}
              className="w-full max-w-xl px-3 py-2 bg-white border border-slate-300 rounded"
            >
              <option value="">Selecciona una App…</option>
              {forms.map((form) => (
                <option key={form.id} value={form.id}>
                  {form.name}
                  {form.recordCount === null
                    ? ""
                    : ` · ${form.recordCount.toLocaleString("es-BO")} registros`}
                </option>
              ))}
            </select>
          </label>
        )}

        {preview && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 border border-slate-200 rounded">
                <b className="block text-slate-900">
                  {preview.fields.length} campos
                </b>
                <span className="text-slate-500">incluye campos de Estado</span>
              </div>
              <div className="p-3 border border-slate-200 rounded">
                <b className="block text-slate-900">
                  {preview.sections.length} secciones
                </b>
                <span className="text-slate-500">
                  orden original conservado
                </span>
              </div>
              <div className="p-3 border border-slate-200 rounded">
                <b className="block text-slate-900">
                  {preview.geometryTypes.join(", ") || "Sin geometría"}
                </b>
                <span className="text-slate-500">geometrías permitidas</span>
              </div>
            </div>
            {preview.statusFieldKey && (
              <div className="p-3 border border-emerald-200 bg-emerald-50 rounded text-xs text-emerald-900">
                <b>Colores detectados:</b> el campo Estado se copiará como regla
                visual de mapa.{" "}
                {preview.fields
                  .find((field) => field.key === preview.statusFieldKey)
                  ?.choices.map((choice) => (
                    <span
                      key={choice.value}
                      className="inline-flex items-center gap-1 ml-2"
                    >
                      <i
                        className="w-2 h-2 rounded-full"
                        style={{ backgroundColor: choice.color ?? "#64748b" }}
                      />
                      {choice.label}
                    </span>
                  ))}
              </div>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-800">
                Qué traer desde Fulcrum
              </legend>
              <label className="flex gap-2 p-3 border rounded cursor-pointer">
                <input
                  type="radio"
                  checked={recordsMode === "structure"}
                  onChange={() => setRecordsMode("structure")}
                />
                <span>
                  <b className="block text-xs">Solo estructura</b>
                  <small className="text-slate-500">
                    Crea Plantilla, App y Dataset vacíos.
                  </small>
                </span>
              </label>
              <label
                className={`flex gap-2 p-3 border rounded ${strategy === "sections" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
              >
                <input
                  type="radio"
                  checked={recordsMode === "records"}
                  disabled={strategy === "sections"}
                  onChange={() => setRecordsMode("records")}
                />
                <span>
                  <b className="block text-xs">Estructura y registros</b>
                  <small className="text-slate-500">
                    Trae atributos, Estado y geometrías. Al repetir, actualiza
                    registros ya importados desde esa App de Fulcrum.
                  </small>
                </span>
              </label>
              {strategy === "sections" && (
                <p className="text-[11px] text-amber-700">
                  Una separación por secciones no identifica de forma segura el
                  destino de cada registro. Para traer datos usa la App completa
                  o separar por valores de un campo.
                </p>
              )}
            </fieldset>

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-800">
                Cómo crear la estructura
              </legend>
              <label className="flex gap-2 p-3 border rounded cursor-pointer">
                <input
                  type="radio"
                  checked={strategy === "preserve"}
                  onChange={() => setStrategy("preserve")}
                />
                <span>
                  <b className="block text-xs">
                    Conservar la App completa — recomendado
                  </b>
                  <small className="text-slate-500">
                    Una App de Fulcrum se convierte en una App de Hansa con sus
                    secciones y colores.
                  </small>
                </span>
              </label>
              <label className="flex gap-2 p-3 border rounded cursor-pointer">
                <input
                  type="radio"
                  checked={strategy === "fieldValues"}
                  onChange={() => setStrategy("fieldValues")}
                />
                <span>
                  <b className="block text-xs">
                    Crear una App por valor de un campo
                  </b>
                  <small className="text-slate-500">
                    Útil para Tipo, Estado, Red o cualquier clasificación
                    elegida.
                  </small>
                </span>
              </label>
              <label className="flex gap-2 p-3 border rounded cursor-pointer">
                <input
                  type="radio"
                  checked={strategy === "sections"}
                  onChange={() => {
                    setStrategy("sections");
                    setRecordsMode("structure");
                  }}
                />
                <span>
                  <b className="block text-xs">Crear una App por sección</b>
                  <small className="text-slate-500">
                    Copia campos generales y una sección por App; los records se
                    mapearán con preview en un paso posterior.
                  </small>
                </span>
              </label>
            </fieldset>

            {strategy === "fieldValues" && (
              <label className="block text-xs font-medium text-slate-700 space-y-1">
                <span>Campo que separa las Apps</span>
                <select
                  value={splitFieldKey}
                  onChange={(event) => setSplitFieldKey(event.target.value)}
                  className="w-full max-w-xl px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  <option value="">Selecciona un campo…</option>
                  {splitCandidates.map((field) => (
                    <option key={field.key} value={field.key}>
                      {field.label} · {field.choices.length} valores
                    </option>
                  ))}
                </select>
                {selectedSplit && (
                  <p className="text-[11px] text-slate-500">
                    Se crearán:{" "}
                    {selectedSplit.choices
                      .map((choice) => choice.label)
                      .join(", ")}
                    .
                  </p>
                )}
              </label>
            )}

            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold text-slate-800">
                Proyecto destino — opcional
              </legend>
              <div className="flex flex-wrap gap-3 text-xs">
                <label>
                  <input
                    type="radio"
                    checked={projectMode === "none"}
                    onChange={() => setProjectMode("none")}
                  />{" "}
                  Solo Apps maestras
                </label>
                <label>
                  <input
                    type="radio"
                    checked={projectMode === "existing"}
                    onChange={() => setProjectMode("existing")}
                  />{" "}
                  Proyecto existente
                </label>
                <label>
                  <input
                    type="radio"
                    checked={projectMode === "new"}
                    onChange={() => setProjectMode("new")}
                  />{" "}
                  Nuevo Proyecto
                </label>
              </div>
              {projectMode === "existing" && (
                <select
                  value={projectId}
                  onChange={(event) => setProjectId(event.target.value)}
                  className="w-full max-w-xl px-3 py-2 border border-slate-300 rounded bg-white"
                >
                  <option value="">Selecciona Proyecto…</option>
                  {catalog.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              )}
              {projectMode === "new" && (
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  placeholder="Nombre del nuevo Proyecto"
                  className="w-full max-w-xl px-3 py-2 border border-slate-300 rounded"
                />
              )}
            </fieldset>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 text-xs border border-slate-300 rounded"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!canSubmit || submitting}
                onClick={() => void submit()}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 disabled:opacity-50 rounded"
              >
                {submitting
                  ? "Creando estructura…"
                  : "Crear estructura en Hansa"}
              </button>
            </div>
          </>
        )}
        {message && (
          <p
            className="p-3 text-xs border border-slate-200 bg-slate-50 rounded"
            role="status"
          >
            {message}
          </p>
        )}
        {importIssues.length > 0 && (
          <div className="p-3 text-xs border border-amber-200 bg-amber-50 rounded">
            <b className="block text-amber-900 mb-1">
              Incidencias de importación
            </b>
            <ul className="list-disc pl-4 space-y-1 text-amber-800">
              {importIssues.slice(0, 10).map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
            {importIssues.length > 10 && (
              <p className="mt-1 text-amber-800">
                Se ocultaron {importIssues.length - 10} incidencias adicionales.
              </p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
