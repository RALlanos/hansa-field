"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  api,
  type Catalog,
  type Collection,
  type Page,
  type Row,
  type Schema,
} from "./contracts";
import { SchemaEditor } from "./schema-editor";
import { ImportWizard } from "./import-wizard";
import "./workspace.css";
import TemplateBuilder from "../templates/template-builder";
import {
  WorkspaceSegmentation,
  WorkspaceUniversalMap,
} from "./workspace-tools";
import { recordScope } from "./record-scope";
import {
  cacheKeys,
  canPrefetch,
  localDataCache,
} from "../../lib/local-data-cache";
import {
  synchronizeWorkspaceScope,
  workspaceScopeKey,
} from "../../lib/incremental-workspace-sync";
const RecordMap = dynamic(
  () => import("./record-map").then((m) => m.RecordMap),
  { ssr: false },
);
const emptySchema: Schema = { sections: [] };
export function OperationalWorkspace() {
  const [templateEditor, setTemplateEditor] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null),
    [section, setSection] = useState("Apps"),
    [isCollapsed, setIsCollapsed] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState(""),
    [schema, setSchema] = useState<Schema>(emptySchema),
    [template, setTemplate] = useState(""),
    [projectId, setProjectId] = useState(""),
    [datasetId, setDatasetId] = useState(""),
    [selectedApps, setSelectedApps] = useState<string[]>([]),
    [page, setPage] = useState<Page>({ rows: [], total: 0, nextCursor: null }),
    [bbox, setBbox] = useState(""),
    [cursor, setCursor] = useState(""),
    [refresh, setRefresh] = useState(0),
    [edit, setEdit] = useState<Row | null>(null),
    [values, setValues] = useState<Record<string, unknown>>({}),
    [coordinates, setCoordinates] = useState(""),
    [editor, setEditor] = useState(false),
    [history, setHistory] = useState<string>(""),
    [targetProject, setTargetProject] = useState(""),
    [segmentationContext, setSegmentationContext] = useState("");
  const reload = useCallback(async (force = false) => {
    const key = cacheKeys.catalog();
    if (!force) {
      const cached = await localDataCache.read<Catalog>(key);
      if (cached) setCatalog(cached.value);
    }
    const fresh = await api<Catalog>("");
    await localDataCache.write(key, fresh, {
      category: "catalog",
      scope: "catalog",
      maxAgeMs: 10 * 60 * 1000,
    });
    setCatalog(fresh);
  }, []);
  useEffect(() => {
    void reload().catch((e) => setError(String(e)));
  }, [reload]);
  useEffect(() => {
    if (!catalog) return;
    const params = new URLSearchParams(window.location.search);
    const destination = params.get("section");
    if (!destination) return;
    const allowed = [
      "Templates",
      "Apps",
      "Proyectos",
      "Cajones",
      "Registros",
      "Importar",
      "Mapa Universal",
      "Segmentación",
      "Configurar",
      "Configurar proyecto",
    ];
    if (allowed.includes(destination)) setSection(destination);
    const app = catalog.apps.find((item) => item.id === params.get("appId"));
    if (app) {
      setDatasetId(app.dataset_id);
      const definition = catalog.collections.find(
        (item) => item.id === app.dataset_id,
      );
      if (definition) setSchema(definition.schema_definition);
    }
    const project = catalog.projects.find(
      (item) => item.id === params.get("projectId"),
    );
    if (project) setProjectId(project.id);
    window.history.replaceState(null, "", "/");
  }, [catalog]);
  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await Promise.all([
        localDataCache.invalidateCategory("catalog"),
        localDataCache.invalidateCategory("map"),
        localDataCache.invalidateCategory("table"),
        localDataCache.invalidateCategory("record-detail"),
      ]);
      await reload(true);
      setRefresh((v) => v + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };
  const collections =
    catalog?.collections.filter((c) =>
      projectId
        ? c.project_id === projectId || c.local_project_id === projectId
        : !!c.app_id,
    ) ?? [];
  const uniqueCollections = collections.filter(
    (c, i, list) => list.findIndex((x) => x.id === c.id) === i,
  );
  const collection: Collection | undefined = uniqueCollections.find(
    (c) => c.id === datasetId,
  );
  const fields =
    collection?.schema_definition.sections.flatMap((s) => s.fields) ?? [];
  const changeBounds = useCallback((value: string) => {
    setBbox(value);
    setCursor("");
  }, []);
  useEffect(() => {
    if (
      section !== "Registros" ||
      !catalog ||
      !bbox ||
      (!datasetId && !projectId)
    )
      return;
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
    const path = `/records?${query}`;
    const pageScope = workspaceScopeKey(scope);
    const cacheKey = cacheKeys.table({ path });
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
      try {
        let cached = await localDataCache.read<PageResponse>(cacheKey);
        if (cached) applyPage(cached.value);
        if (cached) {
          const sync = await synchronizeWorkspaceScope(scope);
          if (sync.invalidated) cached = null;
          if (cached && !cached.stale && !sync.initialized && !sync.invalidated)
            return;
        }
        const data = await api<PageResponse>(path);
        await localDataCache.write(cacheKey, data, {
          category: "table",
          scope: pageScope,
          maxAgeMs: 90_000,
        });
        await synchronizeWorkspaceScope(scope);
        applyPage(data);
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
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [section, datasetId, projectId, bbox, cursor, refresh, catalog]);
  useEffect(() => {
    if (!editor) return;
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setEditor(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, [editor]);
  const openRecords = (id: string, project = "") => {
    setDatasetId(id);
    setProjectId(project);
    setCursor("");
    setSection("Registros");
  };
  const openEditor = (row: Row | null) => {
    if (row) {
      setBusy(true);
      const path = projectId
        ? `/projects/${projectId}/records/${row.project_record_id}`
        : `/records/${row.record_id}`;
      const cacheKey = cacheKeys.recordDetail({
        path,
        recordId: row.record_id,
        projectRecordId: row.project_record_id,
        revision: row.revision,
      });
      const applyDetail = (detail: {
        attributes: Record<string, unknown>;
        geometry: GeoJSON.Geometry | null;
        revision: number;
      }) => {
        setEdit({
          ...row,
          attributes: detail.attributes,
          geometry: detail.geometry,
          revision: detail.revision,
        });
        setValues(detail.attributes);
        setCoordinates(detail.geometry ? JSON.stringify(detail.geometry) : "");
        setEditor(true);
        setHistory("");
      };
      void (async () => {
        try {
          const cached = await localDataCache.read<{
            attributes: Record<string, unknown>;
            geometry: GeoJSON.Geometry | null;
            revision: number;
          }>(cacheKey);
          if (cached) applyDetail(cached.value);
          if (!cached || cached.stale) {
            const detail = await api<{
              attributes: Record<string, unknown>;
              geometry: GeoJSON.Geometry | null;
              revision: number;
            }>(path);
            await localDataCache.write(cacheKey, detail, {
              category: "record-detail",
              scope: row.project_record_id
                ? `project-record:${row.project_record_id}`
                : `record:${row.record_id}`,
              maxAgeMs: 5 * 60 * 1000,
              revision: detail.revision,
            });
            applyDetail(detail);
          }
        } catch (reason) {
          setError(String(reason));
        } finally {
          setBusy(false);
        }
      })();
      return;
    }
    setEdit(row);
    setValues({});
    setCoordinates("");
    setEditor(true);
    setHistory("");
  };
  const contextSelectors = (
    <>
      <label>
        Contexto
        <select
          value={projectId}
          onChange={(e) => {
            setProjectId(e.target.value);
            setDatasetId("");
            setCursor("");
          }}
        >
          <option value="">App independiente</option>
          {(catalog?.projects ?? []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        App / colección
        <select
          value={datasetId}
          onChange={(e) => {
            setDatasetId(e.target.value);
            setCursor("");
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
    </>
  );
  if (templateEditor)
    return (
      <TemplateBuilder
        key={templateEditor}
        templateId={templateEditor}
        onBack={() => {
          setTemplateEditor(null);
          void reload().catch((e) => setError(String(e)));
        }}
      />
    );
  return (
    <div className={`op-shell${isCollapsed ? " collapsed" : ""}`}>
      <aside>
        <div className="op-sidebar-header">
          <button
            className="op-sidebar-toggle"
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
          >
            {isCollapsed ? "☰" : "✕"}
          </button>
          <span>Hansa Field</span>
        </div>
        <p className="op-sidebar-subtitle">Entorno de desarrollo</p>
        <nav>
          {[
            "Templates",
            "Apps",
            "Proyectos",
            "Cajones",
            "Registros",
            "Mapa Universal",
            "Segmentación",
            "Importar",
          ].map((label) => (
            <div
              key={label}
              className={`op-sidebar-menu${section === label ? " op-sidebar-menu-active" : ""}`}
            >
              <button
                onClick={() => {
                  setSection(label);
                  setName("");
                  setError("");
                }}
                aria-label={label}
                data-short={label.slice(0, 1)}
              >
                <span>{label}</span>
              </button>
            </div>
          ))}
        </nav>
      </aside>
      <main>
        {section === "Registros" ? (
          <header className="op-records-bar">
            <h1>Registros</h1>
            {contextSelectors}
            <span className="op-records-count">
              {page.total} registros
            </span>
            <button
              disabled={!collection}
              onClick={() => openEditor(null)}
            >
              Nuevo registro
            </button>
            <button onClick={() => setSection("Importar")}>
              Importar
            </button>
            <button
              onClick={() => {
                setBbox("-180,-90,180,90");
                setCursor("");
              }}
            >
              Tabla
            </button>
          </header>
        ) : section === "Importar" ? (
          <header className="op-import-bar">
            <div className="op-import-bar-title">
              <small>OPERACIONES GIS</small>
              <h1>Importar</h1>
            </div>
            {contextSelectors}
          </header>
        ) : (
          <header>
            <small>OPERACIONES GIS</small>
            <h1>{section}</h1>
          </header>
        )}
        {error && (
          <p role="alert" className="op-error">
            {error}
          </p>
        )}
        {!catalog ? (
          <p role="status">Cargando…</p>
        ) : (
          <>
            {section === "Segmentación" && (
              <WorkspaceSegmentation
                catalog={catalog}
                context={segmentationContext}
                onContextChange={setSegmentationContext}
              />
            )}
            {section === "Mapa Universal" && (
              <WorkspaceUniversalMap catalog={catalog} />
            )}
            {section === "Templates" && (
              <>
                <button onClick={() => setTemplateEditor("new")}>
                  Crear plantilla
                </button>
                <h2>Templates existentes</h2>
                {catalog.templates.map((t) => (
                  <div className="op-row" key={t.id}>
                    <strong>{t.name}</strong>
                    <span>Molde reutilizable · sin registros</span>
                    <button onClick={() => setTemplateEditor(t.id)}>
                      Configurar plantilla
                    </button>
                  </div>
                ))}
              </>
            )}
            {section === "Apps" && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api("/apps", {
                        name,
                        ...(template ? { templateVersionId: template } : {}),
                      });
                      setName("");
                    });
                  }}
                >
                  <h2>Nueva App</h2>
                  <label>
                    Nombre
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <label>
                    Template opcional
                    <select
                      value={template}
                      onChange={(e) => setTemplate(e.target.value)}
                    >
                      <option value="">Sin Template</option>
                      {catalog.templates.map((t) => (
                        <option key={t.id} value={t.version_id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button disabled={busy}>Crear App</button>
                </form>
                <h2>Apps operativas</h2>
                {catalog.apps.map((app) => (
                  <div className="op-row" key={app.id}>
                    <strong>{app.name}</strong>
                    <div>
                      <button
                        onClick={() => {
                          setSegmentationContext(`app:${app.id}`);
                          setSection("Segmentación");
                        }}
                      >
                        Configurar segmentación
                      </button>
                      <button
                        onClick={() => {
                          openRecords(app.dataset_id);
                        }}
                      >
                        Ver registros
                      </button>
                      <button
                        onClick={() => {
                          setProjectId("");
                          setDatasetId(app.dataset_id);
                          setSchema(
                            catalog.collections.find(
                              (c) => c.id === app.dataset_id,
                            )!.schema_definition,
                          );
                          setSection("Configurar");
                        }}
                      >
                        Configurar formulario
                      </button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {section === "Configurar" && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    if (!collection) return;
                    await api(`/datasets/${collection.id}/schema`, {
                      expectedVersion: collection.version,
                      schema,
                    });
                    setSection("Apps");
                  });
                }}
              >
                <h2>{collection?.name}</h2>
                <SchemaEditor value={schema} onChange={setSchema} />
                <button disabled={busy}>Publicar nueva versión</button>
              </form>
            )}
            {section === "Proyectos" && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api("/projects", { name });
                      setName("");
                    });
                  }}
                >
                  <h2>Nuevo proyecto</h2>
                  <label>
                    Nombre
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <button disabled={busy}>Crear proyecto vacío</button>
                </form>
                <h2>Proyectos existentes</h2>
                {catalog.projects.map((project) => (
                  <div className="op-row" key={project.id}>
                    <strong>{project.name}</strong>
                    <button
                      onClick={() => {
                        setSegmentationContext(`project:${project.id}`);
                        setSection("Segmentación");
                      }}
                    >
                      Configurar segmentación
                    </button>
                    <button
                      onClick={() => {
                        setProjectId(project.id);
                        setDatasetId("");
                        setSection("Configurar proyecto");
                      }}
                    >
                      Abrir Proyecto
                    </button>
                  </div>
                ))}
              </>
            )}
            {section === "Configurar proyecto" && (
              <>
                <h2>
                  {catalog.projects.find((p) => p.id === projectId)?.name}
                </h2>
                <button onClick={() => openRecords("", projectId)}>
                  Ver mapa y tabla del Proyecto
                </button>
                <h3>Apps y colecciones locales</h3>
                {uniqueCollections.map((c) => (
                  <div className="op-row" key={c.id}>
                    <strong>{c.name}</strong>
                    <span>
                      {c.local_project_id
                        ? "Colección local · sin App"
                        : "App relacionada"}
                    </span>
                    <button onClick={() => openRecords(c.id, projectId)}>
                      Ver registros
                    </button>
                  </div>
                ))}
                <h3>Relacionar App existente</h3>
                {catalog.apps
                  .filter(
                    (a) => !uniqueCollections.some((c) => c.app_id === a.id),
                  )
                  .map((a) => (
                    <button
                      disabled={busy}
                      key={a.id}
                      onClick={() =>
                        void run(async () => {
                          await api(`/projects/${projectId}/apps`, {
                            appId: a.id,
                          });
                        })
                      }
                    >
                      {a.name} +
                    </button>
                  ))}
                <h3>Aplicar Cajón</h3>
                {catalog.blocks.map((b) => (
                  <div key={b.id}>
                    <span>
                      {b.name}:{" "}
                      {b.app_ids
                        .map(
                          (id) => catalog.apps.find((a) => a.id === id)?.name,
                        )
                        .join(", ")}
                    </span>
                    <button
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          await api(
                            `/projects/${projectId}/blocks/${b.id}`,
                            {},
                          );
                        })
                      }
                    >
                      Confirmar aplicación
                    </button>
                  </div>
                ))}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api(`/projects/${projectId}/collections`, {
                        name,
                        schema,
                      });
                      setName("");
                      setSchema(emptySchema);
                    });
                  }}
                >
                  <h3>Nueva colección local (sin App)</h3>
                  <label>
                    Nombre
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <SchemaEditor value={schema} onChange={setSchema} />
                  <button disabled={busy}>Crear colección local</button>
                </form>
              </>
            )}
            {section === "Cajones" && (
              <>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void run(async () => {
                      await api("/blocks", { name, appIds: selectedApps });
                      setName("");
                      setSelectedApps([]);
                    });
                  }}
                >
                  <h2>Nuevo Cajón</h2>
                  <label>
                    Nombre
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </label>
                  <div className="op-select-list">
                    {catalog.apps.map((a) => (
                      <label key={a.id}>
                        <input
                          type="checkbox"
                          checked={selectedApps.includes(a.id)}
                          onChange={(e) =>
                            setSelectedApps(
                              e.target.checked
                                ? [...selectedApps, a.id]
                                : selectedApps.filter((id) => id !== a.id),
                            )
                          }
                        />
                        {a.name}
                      </label>
                    ))}
                  </div>
                  <button disabled={busy || !selectedApps.length}>
                    Guardar receta
                  </button>
                </form>
                {catalog.blocks.map((b) => (
                  <div className="op-row" key={b.id}>
                    <strong>{b.name}</strong>
                    <span>{b.app_ids.length} Apps · no contiene registros</span>
                  </div>
                ))}
              </>
            )}
            {section === "Importar" && (
              <ImportWizard
                key={`${projectId}:${datasetId}`}
                collections={
                  datasetId
                    ? uniqueCollections.filter((c) => c.id === datasetId)
                    : uniqueCollections
                }
                projectId={projectId}
                onComplete={() => setRefresh((v) => v + 1)}
              />
            )}
            {section === "Registros" && (
              <>
                <RecordMap
                  catalog={catalog}
                  projectId={projectId}
                  datasetId={datasetId}
                  refresh={refresh}
                  onBounds={changeBounds}
                  onSelect={(row) => {
                    setDatasetId(row.dataset_id);
                    openEditor(row);
                  }}
                />
                <p>La tabla está paginada: máximo 100 filas por página.</p>
                <div className="op-table">
                  <table>
                    <thead>
                      <tr>
                        <th>Registro</th>
                        {fields.map((f) => (
                          <th key={f.id}>{f.label}</th>
                        ))}
                        {!fields.length && <th>Atributos</th>}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {page.rows.map((row) => (
                        <tr key={row.project_record_id ?? row.record_id}>
                          <td>{row.record_id.slice(0, 8)}</td>
                          {fields.map((f) => (
                            <td key={f.id}>
                              {String(row.attributes[f.id] ?? "")}
                            </td>
                          ))}
                          {!fields.length && (
                            <td>
                              {Object.values(row.attributes)
                                .map(String)
                                .join(" · ")}
                            </td>
                          )}
                          <td>
                            <button
                              onClick={() => {
                                setDatasetId(row.dataset_id);
                                openEditor(row);
                              }}
                            >
                              {projectId ? "Editar" : "Ver detalle"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {!page.rows.length && <p>No hay registros en esta área.</p>}
                </div>
                <button disabled={!cursor} onClick={() => setCursor("")}>
                  Primera página
                </button>
                <button
                  disabled={!page.nextCursor}
                  onClick={() => setCursor(page.nextCursor ?? "")}
                >
                  Siguiente
                </button>
              </>
            )}
          </>
        )}
      </main>
      {editor && (
        <div
          className="op-backdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget) setEditor(false);
          }}
          role="presentation"
        >
          <section
            className="op-dialog"
            role="dialog"
            aria-modal="true"
            aria-label="Registro"
          >
            <button
              className="op-close"
              aria-label="Cerrar"
              onClick={() => setEditor(false)}
            >
              ×
            </button>
            <h2>{edit ? "Registro" : "Nuevo registro"}</h2>
            {fields.map((field) => (
              <label key={field.id}>
                {field.label}
                <input
                  disabled={!!edit && !projectId}
                  type={
                    field.type === "number"
                      ? "number"
                      : field.type === "date"
                        ? "date"
                        : "text"
                  }
                  value={String(values[field.id] ?? "")}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [field.id]:
                        field.type === "number"
                          ? e.target.value === ""
                            ? null
                            : Number(e.target.value)
                          : field.type === "boolean"
                            ? e.target.value === "true"
                            : e.target.value,
                    })
                  }
                />
              </label>
            ))}
            <label>
              Geometría GeoJSON (EPSG:4326)
              <textarea
                disabled={!!edit && !projectId}
                placeholder={'{"type":"Point","coordinates":[-63.18,-17.78]}'}
                value={coordinates}
                onChange={(e) => setCoordinates(e.target.value)}
              />
            </label>
            {(!edit || projectId) && (
              <button
                disabled={busy || !collection}
                onClick={() =>
                  void run(async () => {
                    const geometry = coordinates.trim()
                      ? JSON.parse(coordinates)
                      : null;
                    if (edit) {
                      await api(
                        `/projects/${projectId}/records/${edit.project_record_id}`,
                        {
                          expectedRevision: edit.revision,
                          attributesOverride: values,
                          geometryOverride: geometry,
                        },
                        "PATCH",
                      );
                    } else {
                      await api("/records", {
                        datasetId,
                        ...(projectId ? { projectId } : {}),
                        ...(projectId && collection?.project_app_id
                          ? { projectAppId: collection.project_app_id }
                          : {}),
                        attributes: values,
                        geometry,
                      });
                    }
                    setEditor(false);
                  })
                }
              >
                Guardar
              </button>
            )}
            {edit && (
              <>
                <button
                  onClick={() =>
                    void run(async () => {
                      setHistory(
                        JSON.stringify(
                          await api(`/records/${edit.record_id}`),
                          null,
                          2,
                        ),
                      );
                    })
                  }
                >
                  Procedencia e historial
                </button>
                {projectId && (
                  <button
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await api(
                          `/projects/${projectId}/records/${edit.project_record_id}`,
                          { expectedRevision: edit.revision },
                          "DELETE",
                        );
                        setEditor(false);
                      })
                    }
                  >
                    Retirar del Proyecto
                  </button>
                )}
                <label>
                  Incorporar a otro Proyecto
                  <select
                    value={targetProject}
                    onChange={(e) => setTargetProject(e.target.value)}
                  >
                    <option value="">Seleccionar destino</option>
                    {catalog?.projects
                      .filter((p) => p.id !== projectId)
                      .map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  disabled={busy || !targetProject}
                  onClick={() =>
                    void run(async () => {
                      const target = catalog?.collections.find(
                        (c) =>
                          c.id === datasetId && c.project_id === targetProject,
                      );
                      if (!target?.project_app_id)
                        throw new Error(
                          "Relaciona primero esta App al Proyecto destino.",
                        );
                      await api(`/projects/${targetProject}/incorporate`, {
                        recordId: edit.record_id,
                        projectAppId: target.project_app_id,
                      });
                      setEditor(false);
                    })
                  }
                >
                  Confirmar incorporación
                </button>
              </>
            )}
            {history && <pre>{history}</pre>}
          </section>
        </div>
      )}
    </div>
  );
}
