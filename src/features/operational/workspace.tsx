"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { api, type Catalog, type Collection, type Schema } from "./contracts";
import { SchemaEditor } from "./schema-editor";
import { ImportWizard } from "../import/import-wizard";
import { RecordsWorkspace } from "../records/records-workspace";
import { UniversalMapWorkspace } from "../universal-map/universal-map";
import { WorkspaceSegmentation } from "./workspace-tools";
import "./workspace.css";
import TemplateBuilder from "../templates/template-builder";
import { cacheKeys, localDataCache } from "../../lib/local-data-cache";

const emptySchema: Schema = { sections: [] };

const defaultCatalog: Catalog = {
  templates: [],
  apps: [],
  projects: [],
  collections: [],
  blocks: [],
};

export type Section =
  | "Templates"
  | "Apps"
  | "Proyectos"
  | "Cajones"
  | "Registros"
  | "Importar"
  | "Mapa Universal"
  | "Segmentación"
  | "Configurar"
  | "Configurar proyecto";

export function OperationalWorkspace({
  initialSection = "Apps",
}: {
  initialSection?: Section;
} = {}) {
  const router = useRouter();
  const rawPathname = usePathname();
  const pathname = rawPathname || "/";

  const sectionFromPath = useMemo((): Section => {
    if (pathname === "/records") return "Registros";
    if (pathname === "/map") return "Mapa Universal";
    if (pathname === "/import") return "Importar";
    if (pathname === "/segmentation") return "Segmentación";
    if (pathname === "/projects") return "Proyectos";
    if (pathname === "/blocks") return "Cajones";
    if (pathname === "/templates") return "Templates";
    if (pathname === "/apps") return "Apps";
    return initialSection;
  }, [pathname, initialSection]);

  const [templateEditor, setTemplateEditor] = useState<string | null>(null);
  const [catalog, setCatalog] = useState<Catalog>(defaultCatalog);
  const [section, setSection] = useState<Section>(sectionFromPath);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [schema, setSchema] = useState<Schema>(emptySchema);
  const [template, setTemplate] = useState("");
  const [projectId, setProjectId] = useState("");
  const [datasetId, setDatasetId] = useState("");
  const [selectedApps, setSelectedApps] = useState<string[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [segmentationContext, setSegmentationContext] = useState("");

  useEffect(() => {
    setSection(sectionFromPath);
  }, [sectionFromPath]);

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
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const destination = params.get("section") as Section | null;
    const allowed: Section[] = [
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
    if (destination && allowed.includes(destination)) {
      setSection(destination);
    }
    const targetAppId = params.get("appId") || params.get("datasetId");
    if (targetAppId) {
      const app = catalog.apps.find(
        (item) => item.id === targetAppId || item.dataset_id === targetAppId,
      );
      if (app) {
        setDatasetId(app.dataset_id);
        const definition = catalog.collections.find(
          (item) => item.id === app.dataset_id,
        );
        if (definition) setSchema(definition.schema_definition);
      } else {
        setDatasetId(targetAppId);
      }
    }
    const targetProjectId = params.get("projectId");
    if (targetProjectId) {
      const project = catalog.projects.find(
        (item) => item.id === targetProjectId,
      );
      if (project) setProjectId(project.id);
      else setProjectId(targetProjectId);
    }
  }, [catalog]);

  useEffect(() => {
    if (
      catalog?.apps.length &&
      !datasetId &&
      !projectId &&
      section === "Registros"
    ) {
      const defaultApp = catalog.apps[0]?.dataset_id ?? "";
      if (defaultApp) setDatasetId(defaultApp);
    }
  }, [catalog, datasetId, projectId, section]);

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
      setError(e instanceof Error ? e.message : "Error durante la operación.");
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

  const openRecords = (id: string, project = "") => {
    const targetDataset =
      id || (project ? "" : (catalog.apps[0]?.dataset_id ?? ""));
    setDatasetId(targetDataset);
    setProjectId(project);
    setSection("Registros");
    const query = new URLSearchParams();
    if (project) query.set("projectId", project);
    if (targetDataset) query.set("datasetId", targetDataset);
    const qStr = query.toString();
    try {
      router.push(qStr ? `/records?${qStr}` : `/records`);
    } catch {}
  };

  if (templateEditor) {
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
  }

  return (
    <div className={`op-shell${isCollapsed ? " collapsed" : ""}`}>
      {/* Sidebar */}
      <aside className="op-sidebar">
        <div className="op-sidebar-header">
          <button
            type="button"
            className="op-sidebar-toggle"
            onClick={() => setIsCollapsed((v) => !v)}
            aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            title={isCollapsed ? "Expandir" : "Colapsar"}
          >
            {isCollapsed ? "☰" : "✕"}
          </button>
          {!isCollapsed && (
            <div className="op-sidebar-brand truncate">
              <span className="font-bold text-white tracking-wide">
                Hansa Field
              </span>
              <p className="op-sidebar-subtitle">Entorno Operativo GIS</p>
            </div>
          )}
        </div>

        <nav className="op-sidebar-nav">
          {/* Navigation Group 1: Datos y Territorio */}
          <div className="op-nav-group">
            {!isCollapsed && <p className="op-nav-label">DATOS Y TERRITORIO</p>}
            {[
              { label: "Registros", icon: "📋", href: "/records" },
              { label: "Mapa Universal", icon: "🗺️", href: "/map" },
              { label: "Importar", icon: "📥", href: "/import" },
              { label: "Segmentación", icon: "🌳", href: "/segmentation" },
            ].map((item) => (
              <div
                key={item.label}
                className={`op-sidebar-menu${section === item.label ? " op-sidebar-menu-active" : ""}`}
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    if (
                      item.label === "Registros" &&
                      !datasetId &&
                      !projectId
                    ) {
                      const defaultApp = catalog.apps[0]?.dataset_id ?? "";
                      if (defaultApp) setDatasetId(defaultApp);
                    }
                    setSection(item.label as Section);
                    setError("");
                  }}
                >
                  <span className="op-menu-icon">{item.icon}</span>
                  {!isCollapsed && (
                    <span className="op-menu-text">{item.label}</span>
                  )}
                </Link>
              </div>
            ))}
          </div>

          {/* Navigation Group 2: Configuración y Modelado */}
          <div className="op-nav-group">
            {!isCollapsed && <p className="op-nav-label">ESTRUCTURAS Y APPS</p>}
            {[
              { label: "Apps", icon: "📱", href: "/apps" },
              { label: "Proyectos", icon: "📁", href: "/projects" },
              { label: "Cajones", icon: "📦", href: "/blocks" },
              { label: "Templates", icon: "📐", href: "/templates" },
            ].map((item) => (
              <div
                key={item.label}
                className={`op-sidebar-menu${section === item.label ? " op-sidebar-menu-active" : ""}`}
              >
                <Link
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  onClick={() => {
                    setSection(item.label as Section);
                    setError("");
                  }}
                >
                  <span className="op-menu-icon">{item.icon}</span>
                  {!isCollapsed && (
                    <span className="op-menu-text">{item.label}</span>
                  )}
                </Link>
              </div>
            ))}
          </div>
        </nav>

        {!isCollapsed && (
          <div className="op-sidebar-footer">
            <div className="op-footer-status">
              <span className="op-status-dot" />
              <span>PostGIS · Conectado</span>
            </div>
            <p className="op-footer-info">Hansa Ltda. · Redes & Telecom</p>
          </div>
        )}
      </aside>

      {/* Main Workspace Area */}
      <main className="op-main-container">
        {/* Full Records Workspace */}
        {section === "Registros" && (
          <RecordsWorkspace
            catalog={catalog}
            initialProjectId={projectId}
            initialDatasetId={datasetId}
            onNavigateToImport={(pId, dId) => {
              setProjectId(pId);
              setDatasetId(dId);
              setSection("Importar");
              try {
                router.push(pId ? `/import?projectId=${pId}` : `/import`);
              } catch {}
            }}
          />
        )}

        {/* Universal Map Workspace */}
        {section === "Mapa Universal" && (
          <UniversalMapWorkspace catalog={catalog} />
        )}

        {/* Import Wizard */}
        {section === "Importar" && (
          <div className="flex-1 flex flex-col h-screen overflow-hidden">
            <header className="h-13 bg-slate-900 text-white px-4 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <span className="w-2.5 h-2.5 rounded-full bg-sky-400" />
                <h1 className="text-sm font-semibold tracking-wide text-white">
                  Importar Datos GIS
                </h1>
              </div>
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400">Contexto:</span>
                <select
                  value={projectId}
                  onChange={(e) => {
                    setProjectId(e.target.value);
                    setDatasetId("");
                  }}
                  className="bg-slate-800 text-white text-xs px-2.5 py-1 rounded border border-slate-700"
                >
                  <option value="">App independiente</option>
                  {catalog.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </header>
            <ImportWizard
              key={`${projectId}:${datasetId}`}
              collections={
                datasetId
                  ? uniqueCollections.filter((c) => c.id === datasetId)
                  : uniqueCollections
              }
              projectId={projectId}
              onComplete={() => {
                setRefresh((v) => v + 1);
                setSection("Registros");
                try {
                  router.push("/records");
                } catch {}
              }}
              onViewRecords={() => {
                setSection("Registros");
                try {
                  router.push("/records");
                } catch {}
              }}
            />
          </div>
        )}

        {/* Segmentation */}
        {section === "Segmentación" && (
          <div className="flex-1 flex flex-col h-screen overflow-y-auto p-6 bg-slate-100">
            <WorkspaceSegmentation
              catalog={catalog}
              context={segmentationContext}
              onContextChange={setSegmentationContext}
            />
          </div>
        )}

        {/* Apps Management */}
        {section === "Apps" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 max-w-5xl mx-auto w-full space-y-6">
            <header className="border-b border-slate-200 pb-3">
              <small className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ADMINISTRACIÓN
              </small>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">Apps</h1>
              <p className="text-xs text-slate-500 mt-1">
                Una App define la recolección de campo, su esquema de formulario
                y su dataset base de registros.
              </p>
            </header>

            {error && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-800">
                {error}
              </div>
            )}

            {/* Create App Form */}
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
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4"
            >
              <h2 className="text-sm font-semibold text-slate-800">
                Crear Nueva App
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block text-xs font-medium text-slate-700 space-y-1">
                  <span>Nombre de la App</span>
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ej.: Inspección de Postes Eléctricos"
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-sky-500"
                  />
                </label>
                <label className="block text-xs font-medium text-slate-700 space-y-1">
                  <span>Plantilla opcional (Template)</span>
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                    className="w-full text-xs px-3 py-2 border border-slate-300 rounded bg-white"
                  >
                    <option value="">Sin plantilla (Formulario vacío)</option>
                    {catalog?.templates.map((t) => (
                      <option key={t.id} value={t.version_id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="flex justify-end">
                <button
                  disabled={busy || !name.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy ? "Creando…" : "Crear App"}
                </button>
              </div>
            </form>

            {/* Apps List */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Apps Operativas
              </h2>
              {catalog?.apps.length ? (
                <div className="grid grid-cols-1 gap-3">
                  {catalog.apps.map((app) => (
                    <div
                      key={app.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300 transition"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {app.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          Dataset ID:{" "}
                          <span className="font-mono text-[11px]">
                            {app.dataset_id}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setSegmentationContext(`app:${app.id}`);
                            setSection("Segmentación");
                            try {
                              router.push(
                                `/segmentation?context=app:${app.id}`,
                              );
                            } catch {}
                          }}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition font-medium"
                        >
                          Segmentación
                        </button>
                        <button
                          onClick={() => {
                            setProjectId("");
                            setDatasetId(app.dataset_id);
                            const def = catalog.collections.find(
                              (c) => c.id === app.dataset_id,
                            );
                            if (def) setSchema(def.schema_definition);
                            setSection("Configurar");
                          }}
                          className="px-2.5 py-1 text-xs text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition font-medium"
                        >
                          Configurar Formulario
                        </button>
                        <button
                          onClick={() => openRecords(app.dataset_id)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition"
                        >
                          Ver Registros →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg">
                  No hay Apps creadas aún.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Projects Management */}
        {section === "Proyectos" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 max-w-5xl mx-auto w-full space-y-6">
            <header className="border-b border-slate-200 pb-3">
              <small className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ADMINISTRACIÓN
              </small>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                Proyectos
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Los proyectos organizan referencias contextuales de múltiples
                Apps y colecciones locales sin duplicar la fuente maestra.
              </p>
            </header>

            {/* Create Project Form */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/projects", { name });
                  setName("");
                });
              }}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4"
            >
              <h2 className="text-sm font-semibold text-slate-800">
                Nuevo Proyecto
              </h2>
              <label className="block text-xs font-medium text-slate-700 space-y-1">
                <span>Nombre del Proyecto</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej.: Mantenimiento Red Norte 2026"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded focus:ring-1 focus:ring-sky-500"
                />
              </label>
              <div className="flex justify-end">
                <button
                  disabled={busy || !name.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy ? "Creando…" : "Crear Proyecto"}
                </button>
              </div>
            </form>

            {/* Projects List */}
            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Proyectos Existentes
              </h2>
              {catalog?.projects.length ? (
                <div className="grid grid-cols-1 gap-3">
                  {catalog.projects.map((project) => (
                    <div
                      key={project.id}
                      className="bg-white border border-slate-200 rounded-lg p-4 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:border-slate-300 transition"
                    >
                      <div>
                        <h3 className="text-sm font-semibold text-slate-900">
                          {project.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                          ID:{" "}
                          <span className="font-mono text-[11px]">
                            {project.id}
                          </span>
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => {
                            setSegmentationContext(`project:${project.id}`);
                            setSection("Segmentación");
                            try {
                              router.push(
                                `/segmentation?context=project:${project.id}`,
                              );
                            } catch {}
                          }}
                          className="px-2.5 py-1 text-xs text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded transition font-medium"
                        >
                          Segmentación
                        </button>
                        <button
                          onClick={() => {
                            setProjectId(project.id);
                            setDatasetId("");
                            setSection("Configurar proyecto");
                          }}
                          className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition"
                        >
                          Configurar Proyecto
                        </button>
                        <button
                          onClick={() => openRecords("", project.id)}
                          className="px-3 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition"
                        >
                          Ver Registros →
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-slate-500 bg-white border border-dashed border-slate-300 rounded-lg">
                  No hay proyectos configurados aún.
                </div>
              )}
            </div>
          </div>
        )}

        {/* Project Details Configuration */}
        {section === "Configurar proyecto" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 max-w-5xl mx-auto w-full space-y-6">
            <header className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <small className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  CONFIGURACIÓN DE PROYECTO
                </small>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                  {catalog.projects.find((p) => p.id === projectId)?.name ??
                    "Proyecto"}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => openRecords("", projectId)}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition"
              >
                Ver mapa y tabla del Proyecto →
              </button>
            </header>

            {/* Linked Collections & Apps */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4">
              <h2 className="text-sm font-semibold text-slate-800">
                Apps y Colecciones Vinculadas
              </h2>
              <div className="space-y-2">
                {uniqueCollections.map((c) => (
                  <div
                    key={c.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-slate-900 font-semibold">
                        {c.name}
                      </strong>
                      <span className="text-slate-500 ml-2">
                        {c.local_project_id
                          ? "· Colección local propia"
                          : "· App vinculada"}
                      </span>
                    </div>
                    <button
                      onClick={() => openRecords(c.id, projectId)}
                      className="px-2.5 py-1 text-sky-700 bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded font-medium transition"
                    >
                      Ver registros
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Relate Existing App */}
            <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Vincular App Existente al Proyecto
              </h2>
              <p className="text-xs text-slate-500">
                Permite que el proyecto acceda a los registros de la App y
                registre participaciones contextuales (ProjectRecords).
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
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
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition"
                    >
                      + {a.name}
                    </button>
                  ))}
              </div>
            </div>

            {/* Apply Block (Cajón) */}
            {catalog.blocks.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-3">
                <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                  <span>📦</span> Aplicar Cajón de Apps al Proyecto
                </h2>
                <p className="text-xs text-slate-500">
                  Un Cajón agrupa un paquete predefinido de Apps operativas para
                  vincularlas juntas a este proyecto.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {catalog.blocks.map((b) => (
                    <div
                      key={b.id}
                      className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                    >
                      <div>
                        <strong className="text-slate-900 font-semibold block">
                          {b.name}
                        </strong>
                        <span className="text-slate-500 text-[11px]">
                          {b.app_ids.length} Apps en la receta
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            await api(`/projects/${projectId}/blocks/${b.id}`);
                          })
                        }
                        className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-white border border-sky-300 hover:bg-sky-50 rounded shadow-xs transition disabled:opacity-50 shrink-0"
                      >
                        Aplicar Cajón
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Create Local Collection */}
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
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4"
            >
              <h2 className="text-sm font-semibold text-slate-800">
                Crear Colección Local (exclusiva de este Proyecto)
              </h2>
              <label className="block text-xs font-medium text-slate-700 space-y-1">
                <span>Nombre de la colección</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej.: Trazado de Cables Subterráneos"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded"
                />
              </label>
              <SchemaEditor value={schema} onChange={setSchema} />
              <div className="flex justify-end">
                <button
                  disabled={busy || !name.trim()}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy ? "Creando…" : "Crear Colección Local"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Cajones (Blocks) Management */}
        {section === "Cajones" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 max-w-5xl mx-auto w-full space-y-6">
            <header className="border-b border-slate-200 pb-3">
              <small className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                ADMINISTRACIÓN
              </small>
              <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                Cajones
              </h1>
              <p className="text-xs text-slate-500 mt-1">
                Un Cajón es una receta que agrupa varias Apps para aplicarlas
                juntas a cualquier Proyecto.
              </p>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api("/blocks", { name, appIds: selectedApps });
                  setName("");
                  setSelectedApps([]);
                });
              }}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4"
            >
              <h2 className="text-sm font-semibold text-slate-800">
                Nuevo Cajón
              </h2>
              <label className="block text-xs font-medium text-slate-700 space-y-1">
                <span>Nombre del Cajón</span>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ej.: Kit de Mantenimiento Eléctrico"
                  className="w-full text-xs px-3 py-2 border border-slate-300 rounded"
                />
              </label>
              <div className="space-y-2">
                <span className="text-xs font-medium text-slate-700">
                  Seleccionar Apps del Cajón:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-slate-200 rounded">
                  {catalog.apps.map((a) => (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 text-xs cursor-pointer select-none"
                    >
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
                      <span className="truncate">{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={busy || !name.trim() || !selectedApps.length}
                  className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy ? "Guardando…" : "Guardar Cajón"}
                </button>
              </div>
            </form>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Cajones Configurados
              </h2>
              {catalog.blocks.map((b) => (
                <div
                  key={b.id}
                  className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div>
                    <strong className="text-slate-900 font-semibold text-sm block">
                      {b.name}
                    </strong>
                    <span className="text-slate-500">
                      {b.app_ids.length} Apps asociadas · Receta reutilizable
                    </span>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {b.app_ids.map((appId) => {
                        const app = catalog.apps.find((a) => a.id === appId);
                        return (
                          <span
                            key={appId}
                            className="px-2 py-0.5 bg-slate-100 border border-slate-200 text-slate-700 rounded text-[11px] font-medium"
                          >
                            {app?.name ?? appId.slice(0, 8)}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {catalog.projects.length > 0 && (
                    <div className="flex items-center gap-2 shrink-0 pt-2 sm:pt-0">
                      <select
                        id={`target-proj-${b.id}`}
                        defaultValue=""
                        className="text-xs px-2.5 py-1.5 bg-white border border-slate-300 rounded text-slate-700 focus:ring-1 focus:ring-sky-500"
                      >
                        <option value="" disabled>
                          Seleccionar Proyecto…
                        </option>
                        {catalog.projects.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          const sel = document.getElementById(
                            `target-proj-${b.id}`,
                          ) as HTMLSelectElement | null;
                          const pId = sel?.value;
                          if (!pId) return;
                          void run(async () => {
                            await api(`/projects/${pId}/blocks/${b.id}`);
                          });
                        }}
                        className="px-3 py-1.5 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                      >
                        Aplicar
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Templates Management */}
        {section === "Templates" && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 max-w-5xl mx-auto w-full space-y-6">
            <header className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <small className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  PLANTILLAS
                </small>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                  Templates
                </h1>
                <p className="text-xs text-slate-500 mt-1">
                  Moldes reutilizables de formulario para estandarizar la
                  creación de Apps.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTemplateEditor("new")}
                className="px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded shadow-xs transition"
              >
                + Crear Plantilla
              </button>
            </header>

            <div className="space-y-3">
              <h2 className="text-sm font-semibold text-slate-800">
                Plantillas Existentes
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {catalog.templates.map((t) => (
                  <div
                    key={t.id}
                    className="p-4 bg-white border border-slate-200 rounded-lg shadow-xs flex items-center justify-between text-xs"
                  >
                    <div>
                      <strong className="text-slate-900 font-semibold text-sm block">
                        {t.name}
                      </strong>
                      <span className="text-slate-500">
                        Molde reutilizable · Sin registros propios
                      </span>
                    </div>
                    <button
                      onClick={() => setTemplateEditor(t.id)}
                      className="px-3 py-1 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition"
                    >
                      Configurar Plantilla
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Configure Form Schema */}
        {section === "Configurar" && collection && (
          <div className="flex-1 overflow-y-auto p-6 bg-slate-100 max-w-5xl mx-auto w-full space-y-6">
            <header className="border-b border-slate-200 pb-3 flex items-center justify-between">
              <div>
                <small className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  DISEÑADOR DE FORMULARIO
                </small>
                <h1 className="text-xl font-bold text-slate-900 mt-0.5">
                  {collection.name}
                </h1>
              </div>
              <button
                onClick={() => setSection("Apps")}
                className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded"
              >
                ← Volver a Apps
              </button>
            </header>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void run(async () => {
                  await api(`/datasets/${collection.id}/schema`, {
                    expectedVersion: collection.version,
                    schema,
                  });
                  setSection("Apps");
                });
              }}
              className="bg-white border border-slate-200 rounded-lg p-5 shadow-xs space-y-4"
            >
              <SchemaEditor value={schema} onChange={setSchema} />
              <div className="flex justify-end pt-4 border-t border-slate-100">
                <button
                  disabled={busy}
                  className="px-5 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded shadow-xs transition"
                >
                  {busy
                    ? "Guardando…"
                    : "Publicar Nueva Versión del Formulario"}
                </button>
              </div>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
