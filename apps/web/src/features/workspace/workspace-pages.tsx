"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";

import { MapSymbol } from "../apps/map-symbols";
import { MultiAppMap, type MultiAppMapStatus } from "../maps/multi-app-map";
import type { MapBounds } from "../maps/multi-app-map-model";
import {
  ProjectRecordsTable,
  type ProjectRecord,
} from "../records/project-records-table";
import { RecordEditor, type RecordSchema } from "../records/record-editor";
import { RecordsWorkspace } from "../records/records-workspace";
import {
  ProjectCreationForm,
  type AppBlockSummary,
} from "./project-creation-form";

type AppSummary = {
  id: string;
  code: string;
  name: string;
  mapColor: string;
  mapIcon: string;
  allowedGeometries: string[];
};
type Project = {
  id: string;
  code: string;
  name: string;
  description: string;
  projectApps: Array<{
    id: string;
    templateId: string;
    code: string;
    name: string;
  }>;
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

function useApps() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void fetch(`${apiUrl}/api/apps`)
      .then((response) => response.json() as Promise<{ data: AppSummary[] }>)
      .then(({ data }) => setApps(data))
      .catch(() => setError("No se pudieron cargar las Apps."))
      .finally(() => setLoading(false));
  }, []);
  return { apps, error, loading };
}

export function LayersPage() {
  const { apps, error, loading } = useApps();
  const [selectionReady, setSelectionReady] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mapStatus, setMapStatus] = useState<MultiAppMapStatus>({
    visibleFeatures: 0,
    totalRecords: 0,
    clustered: true,
    truncated: false,
  });

  useEffect(() => {
    if (!loading && !selectionReady) {
      setSelectedIds(apps.map(({ id }) => id));
      setSelectionReady(true);
    }
  }, [apps, loading, selectionReady]);

  function toggleApp(appId: string) {
    setSelectedIds((current) =>
      current.includes(appId)
        ? current.filter((id) => id !== appId)
        : [...current, appId],
    );
  }

  return (
    <main className="module-page multi-map-page">
      <header className="module-header multi-map-header">
        <div>
          <h1>Capas de Apps</h1>
          <p>Consulta varias aplicaciones en un mismo mapa operativo.</p>
        </div>
        <div className="multi-map-summary" aria-live="polite">
          <strong>{mapStatus.totalRecords.toLocaleString("es-BO")}</strong>
          <span>registros en esta vista</span>
          {mapStatus.clustered && mapStatus.visibleFeatures > 0 && (
            <small>{mapStatus.visibleFeatures} grupos visibles</small>
          )}
        </div>
      </header>
      {error && (
        <p className="multi-map-error" role="alert">
          {error}
        </p>
      )}
      <div className="multi-map-workspace">
        <aside className="multi-map-sidebar" aria-label="Capas disponibles">
          <div className="multi-map-toolbar">
            <div>
              <strong>Aplicaciones</strong>
              <span>
                {selectedIds.length} de {apps.length} activas
              </span>
            </div>
            <button
              type="button"
              onClick={() =>
                setSelectedIds(
                  selectedIds.length === apps.length
                    ? []
                    : apps.map(({ id }) => id),
                )
              }
              disabled={!apps.length}
            >
              {selectedIds.length === apps.length
                ? "Ocultar todas"
                : "Mostrar todas"}
            </button>
          </div>
          <div className="multi-map-layer-list">
            {apps.map((app) => (
              <label className="multi-map-layer" key={app.id}>
                <input
                  checked={selectedIds.includes(app.id)}
                  onChange={() => toggleApp(app.id)}
                  type="checkbox"
                />
                <span className="multi-map-layer-symbol">
                  <MapSymbol
                    icon={app.mapIcon}
                    color={app.mapColor}
                    label={`Símbolo de ${app.name}`}
                  />
                </span>
                <span>
                  <strong>{app.name}</strong>
                  <small>
                    {app.code} · {app.allowedGeometries.join(", ")}
                  </small>
                </span>
                <Link
                  href={`/apps/${app.id}/records`}
                  aria-label={`Abrir registros de ${app.name}`}
                >
                  Abrir
                </Link>
              </label>
            ))}
            {loading && (
              <p className="multi-map-empty">Cargando aplicaciones…</p>
            )}
            {!loading && !apps.length && !error && (
              <p className="multi-map-empty">
                Crea una App para mostrar su capa.
              </p>
            )}
          </div>
        </aside>
        <section className="multi-map-panel" aria-label="Mapa de registros">
          <div className="multi-map-panel-bar">
            <span>
              {mapStatus.clustered
                ? "Los registros se agrupan para mantener el mapa fluido."
                : "Mostrando registros individuales."}
            </span>
            {mapStatus.truncated && (
              <strong>Acércate para cargar los restantes.</strong>
            )}
          </div>
          <MultiAppMap appIds={selectedIds} onStatus={setMapStatus} />
        </section>
      </div>
    </main>
  );
}

export function ProjectsPage() {
  const [blocks, setBlocks] = useState<AppBlockSummary[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(true);
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const load = () =>
    fetch(`${apiUrl}/api/projects`)
      .then((response) => response.json() as Promise<{ data: Project[] }>)
      .then(({ data }) => setProjects(data));
  useEffect(() => {
    void load().catch(() => setMessage("No se pudieron cargar los proyectos."));
  }, []);
  useEffect(() => {
    void fetch(`${apiUrl}/api/blocks`)
      .then(
        (response) => response.json() as Promise<{ data: AppBlockSummary[] }>,
      )
      .then(({ data }) => setBlocks(data))
      .catch(() => setMessage("No se pudieron cargar los Bloques de Apps."))
      .finally(() => setBlocksLoading(false));
  }, []);
  async function create(input: {
    code: string;
    name: string;
    description: string;
    blockIds: string[];
  }) {
    const response = await fetch(`${apiUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(body.message ?? "No se pudo crear el proyecto.");
      return;
    }
    setMessage("Proyecto creado.");
    await load();
  }
  return (
    <main className="module-page projects-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">Organización</p>
          <h1>Proyectos</h1>
          <p>Agrupa referencias a Apps sin duplicar sus registros maestros.</p>
        </div>
      </header>
      <div className="projects-grid">
        <ProjectCreationForm
          blocks={blocks}
          disabled={blocksLoading}
          onCreate={create}
        />
        <section className="module-list">
          <h2>Proyectos existentes</h2>
          {projects.map((project) => (
            <article key={project.id}>
              <div>
                <h2>{project.name}</h2>
                <p>
                  {project.code} · {project.projectApps.length} Apps de Proyecto
                </p>
                <small>{project.description}</small>
              </div>
              <Link
                className="secondary-button"
                href={`/apps/projects/${project.id}/records`}
              >
                Abrir Apps de Proyecto
              </Link>
              <Link
                className="secondary-button"
                href={`/apps/projects/${project.id}/configure`}
              >
                Configurar Proyecto
              </Link>
            </article>
          ))}
          {!projects.length && (
            <p className="records-empty">Todavía no hay proyectos.</p>
          )}
        </section>
      </div>
      {message && <output className="transfer-status">{message}</output>}
    </main>
  );
}

export function ProjectConfigurePage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { apps, loading: appsLoading } = useApps();
  const [project, setProject] = useState<Project | null>(null);
  const [selectedAppId, setSelectedAppId] = useState("");
  const [loadedAppId, setLoadedAppId] = useState("");
  const [schema, setSchema] = useState<RecordSchema>({ sections: [] });
  const [version, setVersion] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    void fetch(`${apiUrl}/api/projects`)
      .then((response) => response.json() as Promise<{ data: Project[] }>)
      .then(({ data }) => {
        const current = data.find((item) => item.id === projectId);
        if (!current) throw new Error("No se encontró el proyecto.");
        setProject(current);
        setSelectedAppId(current.projectApps[0]?.id ?? "");
      })
      .catch((reason: unknown) =>
        setMessage(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar el proyecto.",
        ),
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (!selectedAppId) return;
    const controller = new AbortController();
    setLoadedAppId("");
    void fetch(`${apiUrl}/api/project-apps/${selectedAppId}/versions/latest`, {
      signal: controller.signal,
    })
      .then((response) => {
        if (!response.ok)
          throw new Error("No se pudo cargar la configuración.");
        return response.json() as Promise<{
          version: number;
          schema: RecordSchema;
        }>;
      })
      .then((current) => {
        if (controller.signal.aborted) return;
        setVersion(current.version);
        setSchema(current.schema);
        setLoadedAppId(selectedAppId);
      })
      .catch((reason: unknown) => {
        if (!controller.signal.aborted)
          setMessage(
            reason instanceof Error
              ? reason.message
              : "No se pudo cargar la configuración.",
          );
      });
    return () => controller.abort();
  }, [selectedAppId]);

  const selectedProjectApp = project?.projectApps.find(
    (item) => item.id === selectedAppId,
  );
  const template = apps.find(
    (app) => app.id === selectedProjectApp?.templateId,
  );
  function updateField(
    fieldId: string,
    update: Partial<RecordSchema["sections"][number]["fields"][number]>,
  ) {
    setSchema((current) => ({
      sections: current.sections.map((section) => ({
        ...section,
        fields: section.fields.map((field) =>
          field.id === fieldId ? { ...field, ...update } : field,
        ),
      })),
    }));
  }
  function addProjectField() {
    const section = schema.sections[0] ?? {
      id: crypto.randomUUID(),
      title: "Campos del proyecto",
      fields: [],
    };
    const field = {
      id: crypto.randomUUID(),
      key: `project_field_${Date.now()}`,
      label: "Nuevo campo del proyecto",
      type: "shortText",
      required: false,
    };
    setSchema((current) => ({
      sections: current.sections.length
        ? current.sections.map((item) =>
            item.id === section.id
              ? { ...item, fields: [...item.fields, field] }
              : item,
          )
        : [{ ...section, fields: [field] }],
    }));
  }
  function moveField(sectionId: string, fieldId: string, direction: -1 | 1) {
    setSchema((current) => ({
      sections: current.sections.map((section) => {
        if (section.id !== sectionId) return section;
        const index = section.fields.findIndex((field) => field.id === fieldId);
        const target = index + direction;
        if (index < 0 || target < 0 || target >= section.fields.length)
          return section;
        const fields = [...section.fields];
        [fields[index], fields[target]] = [fields[target], fields[index]];
        return { ...section, fields };
      }),
    }));
  }
  async function save() {
    if (!selectedAppId || loadedAppId !== selectedAppId || saving) return;
    setSaving(true);
    try {
      const response = await fetch(
        `${apiUrl}/api/project-apps/${selectedAppId}/versions`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(schema),
        },
      );
      if (!response.ok) {
        setMessage("No se pudo guardar la configuración de la Project App.");
        return;
      }
      const saved = (await response.json()) as { version: number };
      setVersion(saved.version);
      setMessage(`Configuración guardada como versión ${saved.version}.`);
    } catch {
      setMessage("No se pudo guardar la configuración de la Project App.");
    } finally {
      setSaving(false);
    }
  }
  if (loading || appsLoading)
    return (
      <main className="builder-loading">
        Cargando configuración del proyecto…
      </main>
    );
  if (!project)
    return (
      <main className="builder-loading" role="alert">
        {message || "No se encontró el proyecto."}
      </main>
    );
  return (
    <main className="app-builder project-configure-page">
      <header className="builder-header">
        <Link href="/apps/projects">← Proyectos</Link>
        <div>
          <p className="eyebrow">Configuración de Apps del Proyecto</p>
          <h1>{project.name}</h1>
        </div>
        <p className="builder-code">Versión {version}</p>
        <button
          className="primary-button"
          disabled={saving || !selectedAppId || loadedAppId !== selectedAppId}
          onClick={() => void save()}
          type="button"
        >
          {saving ? "Guardando…" : "Guardar configuración"}
        </button>
      </header>
      {message && (
        <p className="builder-message" role="status">
          {message}
        </p>
      )}
      <div className="project-configure-grid">
        <aside className="builder-palette" aria-label="Apps del proyecto">
          <h2>Apps del Proyecto</h2>
          {project.projectApps.map((projectApp) => (
            <button
              disabled={saving}
              className={projectApp.id === selectedAppId ? "selected" : ""}
              key={projectApp.id}
              onClick={() => setSelectedAppId(projectApp.id)}
              type="button"
            >
              <strong>{projectApp.name}</strong>
              <small>Basada en: {projectApp.code}</small>
            </button>
          ))}
        </aside>
        <section
          className="builder-layout"
          aria-label="Configuración de Project App"
        >
          <div className="layout-heading">
            <div>
              <p className="eyebrow">Project App independiente</p>
              <h2>{selectedProjectApp?.name}</h2>
              <p>
                Basada en {template?.name ?? selectedProjectApp?.code}. La App
                maestra no se modifica.
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={addProjectField}
              type="button"
            >
              + Campo del proyecto
            </button>
          </div>
          {(loadedAppId === selectedAppId ? schema.sections : []).map(
            (section) => (
              <article className="builder-section" key={section.id}>
                <input
                  aria-label="Nombre de la sección"
                  value={section.title}
                  onChange={(event) =>
                    setSchema((current) => ({
                      sections: current.sections.map((item) =>
                        item.id === section.id
                          ? { ...item, title: event.target.value }
                          : item,
                      ),
                    }))
                  }
                />
                {section.fields.map((field) => (
                  <div className="builder-field selected" key={field.id}>
                    <div className="builder-field-select">
                      <strong>{field.label}</strong>
                      <small>
                        {field.key} · {field.type}
                      </small>
                    </div>
                    <div className="field-controls">
                      <button
                        aria-label={`Subir ${field.label}`}
                        disabled={section.fields[0]?.id === field.id}
                        onClick={() => moveField(section.id, field.id, -1)}
                        type="button"
                      >
                        ↑
                      </button>
                      <button
                        aria-label={`Bajar ${field.label}`}
                        disabled={section.fields.at(-1)?.id === field.id}
                        onClick={() => moveField(section.id, field.id, 1)}
                        type="button"
                      >
                        ↓
                      </button>
                    </div>
                    <div className="properties-form project-field-properties">
                      <label>
                        Etiqueta
                        <input
                          value={field.label}
                          onChange={(event) =>
                            updateField(field.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <label className="checkbox-label">
                        <input
                          checked={field.required}
                          onChange={(event) =>
                            updateField(field.id, {
                              required: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />{" "}
                        Obligatorio
                      </label>
                      <label className="checkbox-label">
                        <input
                          checked={field.hidden ?? false}
                          onChange={(event) =>
                            updateField(field.id, {
                              hidden: event.target.checked,
                            })
                          }
                          type="checkbox"
                        />{" "}
                        Oculto por defecto
                      </label>
                      <label className="checkbox-label">
                        <input
                          checked={Boolean(field.visibility)}
                          onChange={(event) => {
                            const source = section.fields.find(
                              (candidate) => candidate.id !== field.id,
                            );
                            updateField(
                              field.id,
                              event.target.checked && source
                                ? {
                                    visibility: {
                                      match: "all",
                                      conditions: [
                                        {
                                          fieldId: source.id,
                                          operator: "equals",
                                          value: "",
                                        },
                                      ],
                                    },
                                  }
                                : { visibility: undefined },
                            );
                          }}
                          type="checkbox"
                        />{" "}
                        Usar visibilidad condicional
                      </label>
                      {field.visibility?.conditions.map((condition, index) => (
                        <div className="rule-row" key={`${field.id}-${index}`}>
                          <select
                            value={condition.fieldId}
                            onChange={(event) =>
                              updateField(field.id, {
                                visibility: {
                                  ...field.visibility!,
                                  conditions: field.visibility!.conditions.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            fieldId: event.target.value,
                                          }
                                        : item,
                                  ),
                                },
                              })
                            }
                          >
                            {section.fields
                              .filter((candidate) => candidate.id !== field.id)
                              .map((candidate) => (
                                <option key={candidate.id} value={candidate.id}>
                                  {candidate.label}
                                </option>
                              ))}
                          </select>
                          <select
                            value={condition.operator}
                            onChange={(event) =>
                              updateField(field.id, {
                                visibility: {
                                  ...field.visibility!,
                                  conditions: field.visibility!.conditions.map(
                                    (item, itemIndex) =>
                                      itemIndex === index
                                        ? {
                                            ...item,
                                            operator: event.target
                                              .value as typeof item.operator,
                                          }
                                        : item,
                                  ),
                                },
                              })
                            }
                          >
                            <option value="equals">es igual a</option>
                            <option value="notEquals">no es igual a</option>
                            <option value="isEmpty">está vacío</option>
                            <option value="isNotEmpty">no está vacío</option>
                          </select>
                          {!(["isEmpty", "isNotEmpty"] as string[]).includes(
                            condition.operator,
                          ) && (
                            <input
                              value={condition.value ?? ""}
                              onChange={(event) =>
                                updateField(field.id, {
                                  visibility: {
                                    ...field.visibility!,
                                    conditions:
                                      field.visibility!.conditions.map(
                                        (item, itemIndex) =>
                                          itemIndex === index
                                            ? {
                                                ...item,
                                                value: event.target.value,
                                              }
                                            : item,
                                      ),
                                  },
                                })
                              }
                            />
                          )}
                        </div>
                      ))}
                      {(field.type === "singleChoice" ||
                        field.type === "multipleChoice") && (
                        <label>
                          Opciones
                          <textarea
                            value={(field.options ?? []).join("\n")}
                            onChange={(event) =>
                              updateField(field.id, {
                                options: event.target.value
                                  .split("\n")
                                  .map((value) => value.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </article>
            ),
          )}
        </section>
      </div>
    </main>
  );
}

export function ProjectRecordsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { apps, error: appsError, loading: appsLoading } = useApps();
  const [project, setProject] = useState<Project | null>(null);
  const [projectError, setProjectError] = useState("");
  const [projectLoading, setProjectLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [tableTotal, setTableTotal] = useState(0);
  const [viewport, setViewport] = useState<MapBounds | null>(null);
  const [tableRevision, setTableRevision] = useState(0);
  const [editor, setEditor] = useState<ProjectRecord | null>(null);
  const [editorSchema, setEditorSchema] = useState<RecordSchema | null>(null);
  const [draftPoint, setDraftPoint] = useState<[number, number] | null>(null);
  const [editorMessage, setEditorMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [mapStatus, setMapStatus] = useState<MultiAppMapStatus>({
    visibleFeatures: 0,
    totalRecords: 0,
    clustered: true,
    truncated: false,
  });

  useEffect(() => {
    void fetch(`${apiUrl}/api/projects`)
      .then((response) => {
        if (!response.ok) throw new Error("No se pudo cargar el proyecto.");
        return response.json() as Promise<{ data: Project[] }>;
      })
      .then(({ data }) => {
        const currentProject = data.find((item) => item.id === projectId);
        if (!currentProject) throw new Error("No se encontró el proyecto.");
        setProject(currentProject);
        setSelectedIds(
          currentProject.projectApps.map((projectApp) => projectApp.id),
        );
      })
      .catch((reason: unknown) =>
        setProjectError(
          reason instanceof Error
            ? reason.message
            : "No se pudo cargar el proyecto.",
        ),
      )
      .finally(() => setProjectLoading(false));
  }, [projectId]);

  const loading = appsLoading || projectLoading;
  const error = projectError || appsError;

  async function openEditor(record: ProjectRecord) {
    setEditorMessage("");
    setDraftPoint(
      record.geometry?.type === "Point" ? record.geometry.coordinates : null,
    );
    try {
      const response = await fetch(
        `${apiUrl}/api/project-apps/${record.projectAppId}/versions/latest`,
      );
      if (!response.ok)
        throw new Error("No se pudo cargar el formulario de esta App.");
      const version = (await response.json()) as {
        schema: RecordSchema;
      } | null;
      setEditorSchema(version?.schema ?? { sections: [] });
      setEditor(record);
    } catch (reason) {
      setEditorMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudo cargar el formulario de esta App.",
      );
    }
  }

  function closeEditor() {
    setEditor(null);
    setEditorSchema(null);
    setDraftPoint(null);
  }

  async function saveProjectRecord(
    attributes: Record<string, unknown>,
    geometry: Readonly<{
      type: "Point";
      coordinates: [number, number];
    }> | null,
  ) {
    if (!editor) return;
    setSaving(true);
    setEditorMessage("");
    try {
      const response = await fetch(
        `${apiUrl}/api/project-apps/${editor.projectAppId}/records/${editor.projectRecordUuid}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attributesOverride: attributes,
            projectAttributes: {},
            geometryOverride: geometry,
          }),
        },
      );
      if (!response.ok)
        throw new Error("No se pudo actualizar el registro del proyecto.");
      closeEditor();
      setTableRevision((current) => current + 1);
      setEditorMessage("Registro del proyecto actualizado.");
    } catch (reason) {
      setEditorMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudo actualizar el registro del proyecto.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading)
    return (
      <main className="builder-loading">Cargando registros del proyecto…</main>
    );
  if (!project)
    return (
      <main className="builder-loading" role="alert">
        {error || "No se encontró el proyecto."}
      </main>
    );

  const projectApps = project.projectApps.map((projectApp) => {
    const template = apps.find((app) => app.id === projectApp.templateId);
    return {
      id: projectApp.id,
      code: projectApp.code,
      name: projectApp.name,
      mapColor: template?.mapColor ?? "#2563eb",
      mapIcon: template?.mapIcon ?? "pin",
      allowedGeometries: template?.allowedGeometries ?? ["Point"],
    };
  });
  return (
    <>
      <RecordsWorkspace
        apps={projectApps}
        backHref="/apps/projects"
        backLabel="Proyectos"
        contextLabel="Registros de proyecto"
        map={
          <div className="project-records-map-shell">
            <div className="multi-map-panel-bar">
              <span>
                {mapStatus.clustered
                  ? "Los registros se agrupan para mantener el mapa fluido."
                  : "Mostrando registros individuales."}
              </span>
              {mapStatus.truncated && (
                <strong>Acércate para cargar los restantes.</strong>
              )}
            </div>
            <MultiAppMap
              appIds={selectedIds}
              onStatus={setMapStatus}
              onViewportChange={setViewport}
              projectId={projectId}
            />
          </div>
        }
        message={
          <>
            {error && (
              <p className="multi-map-error" role="alert">
                {error}
              </p>
            )}
            {editorMessage && (
              <output className="builder-message">{editorMessage}</output>
            )}
          </>
        }
        onSelectedIdsChange={setSelectedIds}
        selectedIds={selectedIds}
        table={
          <ProjectRecordsTable
            bounds={viewport}
            projectAppIds={selectedIds}
            key={`${selectedIds.join(",")}:${viewport?.join(",") ?? "pending"}:${tableRevision}`}
            onEdit={openEditor}
            onTotal={setTableTotal}
            projectId={projectId}
          />
        }
        title={project.name}
        totalRecords={selectedIds.length ? tableTotal : 0}
      />
      {editor && editorSchema && (
        <RecordEditor
          draftPoint={draftPoint}
          locationHint="Ingresa las coordenadas para mover el punto dentro del proyecto."
          onCancel={closeEditor}
          onDraftPointChange={setDraftPoint}
          onSave={saveProjectRecord}
          record={editor}
          saving={saving}
          schema={editorSchema}
        />
      )}
    </>
  );
}

export function SettingsPage() {
  const { apps, error } = useApps();
  return (
    <main className="module-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Espacio Hansa Field</h1>
          <p>Estado del monolito operativo y sus contratos.</p>
        </div>
      </header>
      <section className="settings-summary">
        <article>
          <strong>{apps.length}</strong>
          <span>Apps disponibles</span>
        </article>
        <article>
          <strong>EPSG:4326</strong>
          <span>CRS geográfico</span>
        </article>
        <article>
          <strong>PostGIS</strong>
          <span>Autoridad espacial</span>
        </article>
        <article>
          <strong>API</strong>
          <span>{error ? "Sin conexión" : "Conectada"}</span>
        </article>
      </section>
      <p className="settings-note">
        Hansa Field mantiene su base independiente del ERP. Las futuras
        integraciones se harán mediante APIs explícitas.
      </p>
    </main>
  );
}
