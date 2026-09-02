"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";

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
  appIds: string[];
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

function useApps() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [error, setError] = useState("");
  useEffect(() => {
    void fetch(`${apiUrl}/api/apps`)
      .then((response) => response.json() as Promise<{ data: AppSummary[] }>)
      .then(({ data }) => setApps(data))
      .catch(() => setError("No se pudieron cargar las Apps."));
  }, []);
  return { apps, error };
}

export function LayersPage() {
  const { apps, error } = useApps();
  return (
    <main className="module-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">Representación GIS</p>
          <h1>Capas de Apps</h1>
          <p>Cada App publicada actúa como una capa operativa independiente.</p>
        </div>
      </header>
      {error && <p role="alert">{error}</p>}
      <section className="module-list">
        {apps.map((app) => (
          <article key={app.id}>
            <span
              className="layer-swatch"
              style={{ background: app.mapColor }}
            />
            <div>
              <h2>{app.name}</h2>
              <p>
                {app.code} · {app.allowedGeometries.join(", ")} · icono{" "}
                {app.mapIcon}
              </p>
            </div>
            <Link className="secondary-button" href={`/apps/${app.id}/records`}>
              Abrir mapa
            </Link>
          </article>
        ))}
        {!apps.length && !error && (
          <p className="records-empty">
            No hay capas hasta que se cree una App.
          </p>
        )}
      </section>
    </main>
  );
}

export function ProjectsPage() {
  const { apps } = useApps();
  const [projects, setProjects] = useState<Project[]>([]);
  const [message, setMessage] = useState("");
  const load = () =>
    fetch(`${apiUrl}/api/projects`)
      .then((response) => response.json() as Promise<{ data: Project[] }>)
      .then(({ data }) => setProjects(data));
  useEffect(() => {
    void load().catch(() => setMessage("No se pudieron cargar los proyectos."));
  }, []);
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const response = await fetch(`${apiUrl}/api/projects`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        code: data.get("code"),
        name: data.get("name"),
        description: data.get("description"),
        appIds: data.getAll("appIds"),
      }),
    });
    const body = (await response.json()) as { message?: string };
    if (!response.ok) {
      setMessage(body.message ?? "No se pudo crear el proyecto.");
      return;
    }
    form.reset();
    setMessage("Proyecto creado.");
    await load();
  }
  return (
    <main className="module-page">
      <header className="module-header">
        <div>
          <p className="eyebrow">Organización</p>
          <h1>Proyectos</h1>
          <p>Agrupa referencias a Apps sin duplicar sus registros maestros.</p>
        </div>
      </header>
      <div className="projects-grid">
        <form className="compact-form" onSubmit={create}>
          <h2>Nuevo proyecto</h2>
          <label>
            Nombre
            <input name="name" required minLength={2} />
          </label>
          <label>
            Código
            <input name="code" required pattern="[A-Z][A-Z0-9_]{1,63}" />
          </label>
          <label>
            Descripción
            <textarea name="description" />
          </label>
          <fieldset>
            <legend>Apps relacionadas</legend>
            {apps.map((app) => (
              <label key={app.id}>
                <input name="appIds" type="checkbox" value={app.id} />{" "}
                {app.name}
              </label>
            ))}
          </fieldset>
          <button className="primary-button" type="submit">
            Crear proyecto
          </button>
        </form>
        <section className="module-list">
          <h2>Proyectos existentes</h2>
          {projects.map((project) => (
            <article key={project.id}>
              <div>
                <h2>{project.name}</h2>
                <p>
                  {project.code} · {project.appIds.length} Apps
                </p>
                <small>{project.description}</small>
              </div>
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
