"use client";

import { FormEvent, useEffect, useState } from "react";

type AppSummary = {
  id: string;
  code: string;
  name: string;
  allowedGeometries: string[];
};
const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

export default function AppsPage() {
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    void fetch(`${apiUrl}/api/apps`)
      .then(async (response) => {
        if (!response.ok) throw new Error("No se pudieron cargar las Apps.");
        return response.json() as Promise<{ data: AppSummary[] }>;
      })
      .then(({ data }) => setApps(data))
      .catch(() => setError("No se pudieron cargar las Apps."));
  }, []);
  async function createApp(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const allowedGeometries = ["Point", "LineString", "Polygon"].filter(
      (geometry) => data.get(geometry) === "on",
    );
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`${apiUrl}/api/apps`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: data.get("code"),
          name: data.get("name"),
          allowedGeometries,
        }),
      });
      const body = (await response.json()) as AppSummary | { message?: string };
      if (!response.ok)
        throw new Error(
          "message" in body
            ? (body.message ?? "No se pudo crear la App.")
            : "No se pudo crear la App.",
        );
      setApps((current) =>
        [...current, body as AppSummary].sort((a, b) =>
          a.name.localeCompare(b.name),
        ),
      );
      setIsOpen(false);
      form.reset();
    } catch (reason: unknown) {
      setError(
        reason instanceof Error ? reason.message : "No se pudo crear la App.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <main className="apps-catalog">
      <header className="catalog-header">
        <div>
          <p className="eyebrow">Aplicaciones</p>
          <h1>Apps</h1>
          <p>Define formularios reutilizables y sus registros maestros.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => setIsOpen(true)}
          type="button"
        >
          Nueva App
        </button>
      </header>
      {error && (
        <p className="catalog-error" role="alert">
          {error}
        </p>
      )}
      <section aria-label="Catálogo de Apps" className="app-list">
        {apps.length === 0 ? (
          <div className="empty-state">
            <div className="empty-symbol" aria-hidden="true">
              +
            </div>
            <h2>Todavía no hay Apps</h2>
            <p>
              Crea la primera App para definir campos, geometrías y registros.
            </p>
            <button
              className="secondary-button"
              onClick={() => setIsOpen(true)}
              type="button"
            >
              Crear primera App
            </button>
          </div>
        ) : (
          apps.map((app) => (
            <article className="app-row" key={app.id}>
              <div className="app-row-icon">▦</div>
              <div>
                <h2>{app.name}</h2>
                <p>
                  <strong>{app.code}</strong> ·{" "}
                  {app.allowedGeometries.join(", ")}
                </p>
              </div>
              <button className="secondary-button" type="button">
                Configurar App
              </button>
            </article>
          ))
        )}
      </section>
      {isOpen && (
        <div className="modal-backdrop" role="presentation">
          <form
            aria-labelledby="new-app-title"
            className="app-form"
            onSubmit={createApp}
          >
            <div className="form-heading">
              <div>
                <p className="eyebrow">Nueva aplicación</p>
                <h2 id="new-app-title">Crear App</h2>
              </div>
              <button
                aria-label="Cerrar"
                className="icon-button"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <label>
              Nombre
              <input
                name="name"
                required
                minLength={2}
                maxLength={120}
                placeholder="Ej.: Postes FTTH"
              />
            </label>
            <label>
              Código estable
              <input
                name="code"
                required
                pattern="[A-Z][A-Z0-9_]{1,63}"
                placeholder="POSTES_FTTH"
                title="Usa mayúsculas, números y guion bajo."
              />
            </label>
            <fieldset>
              <legend>Geometrías permitidas</legend>
              <label>
                <input defaultChecked name="Point" type="checkbox" /> Punto
              </label>
              <label>
                <input name="LineString" type="checkbox" /> Línea
              </label>
              <label>
                <input name="Polygon" type="checkbox" /> Polígono
              </label>
            </fieldset>
            <div className="form-actions">
              <button
                className="secondary-button"
                onClick={() => setIsOpen(false)}
                type="button"
              >
                Cancelar
              </button>
              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving ? "Guardando…" : "Crear App"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
