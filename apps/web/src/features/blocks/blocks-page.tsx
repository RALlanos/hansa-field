"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

const api = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";
type App = Readonly<{
  id: string;
  code: string;
  name: string;
  allowedGeometries: string[];
}>;
type Block = Readonly<{
  id: string;
  code: string;
  name: string;
  description: string;
  members: ReadonlyArray<{
    id: string;
    appId: string;
    appVersionId?: string;
    appCode: string;
    appName: string;
  }>;
}>;

export function BlocksPage() {
  const [apps, setApps] = useState<App[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editing, setEditing] = useState<Block | "new" | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const [appsResponse, blocksResponse] = await Promise.all([
      fetch(`${api}/api/apps`),
      fetch(`${api}/api/blocks`),
    ]);
    if (!appsResponse.ok || !blocksResponse.ok)
      throw new Error("No se pudieron cargar los Cajones.");
    const appBody = (await appsResponse.json()) as { data: App[] };
    const blockBody = (await blocksResponse.json()) as { data: Block[] };
    setApps(appBody.data);
    setBlocks(blockBody.data);
  }

  useEffect(() => {
    void load().catch((reason: unknown) =>
      setMessage(
        reason instanceof Error
          ? reason.message
          : "No se pudieron cargar los Cajones.",
      ),
    );
  }, []);

  const visibleApps = useMemo(
    () =>
      apps.filter((app) =>
        `${app.name} ${app.code}`.toLowerCase().includes(query.toLowerCase()),
      ),
    [apps, query],
  );

  function openEditor(block: Block | "new") {
    setEditing(block);
    setSelected(
      block === "new" ? [] : block.members.map((member) => member.appId),
    );
    setQuery("");
    setMessage("");
  }

  function toggle(appId: string) {
    setSelected((current) =>
      current.includes(appId)
        ? current.filter((id) => id !== appId)
        : [...current, appId],
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing || saving) return;
    setSaving(true);
    try {
      const form = new FormData(event.currentTarget);
      const members = await Promise.all(
        selected.map(async (appId) => {
          const existing =
            editing !== "new"
              ? editing.members.find((member) => member.appId === appId)
              : undefined;
          if (existing?.appVersionId)
            return { appId, appVersionId: existing.appVersionId };
          const response = await fetch(
            `${api}/api/apps/${appId}/versions/latest`,
          );
          if (!response.ok)
            throw new Error("No se pudo cargar una versión de App.");
          const version = (await response.json()) as { id: string };
          return { appId, appVersionId: version.id };
        }),
      );
      const url =
        editing === "new"
          ? `${api}/api/blocks`
          : `${api}/api/blocks/${editing?.id}`;
      const response = await fetch(url, {
        method: editing === "new" ? "POST" : "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          description: form.get("description"),
          members,
        }),
      });
      if (!response.ok) {
        const body = (await response.json()) as { message?: string };
        setMessage(body.message ?? "No se pudo guardar el Cajón.");
        return;
      }
      setEditing(null);
      setMessage(editing === "new" ? "Cajón creado." : "Cajón actualizado.");
      await load();
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "No se pudo guardar el Cajón.",
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
          <h1>Cajones de Apps</h1>
          <p>Agrupa Apps reutilizables para incorporarlas a proyectos.</p>
        </div>
        <button
          className="primary-button"
          onClick={() => openEditor("new")}
          type="button"
        >
          Nuevo Cajón
        </button>
      </header>
      {message && (
        <p className="builder-message" role="status">
          {message}
        </p>
      )}
      <section className="app-list">
        {blocks.map((block) => (
          <article className="app-row" key={block.id}>
            <div>
              <h2>{block.name}</h2>
              <p>
                <strong>{block.code}</strong> · {block.members.length} Apps
              </p>
              <small>
                {block.description} ·{" "}
                {block.members.map((member) => member.appName).join(", ")}
              </small>
            </div>
            <button
              className="secondary-button"
              onClick={() => openEditor(block)}
              type="button"
            >
              Configurar Cajón
            </button>
          </article>
        ))}
        {!blocks.length && (
          <p className="records-empty">Todavía no hay Cajones.</p>
        )}
      </section>
      {editing && (
        <div className="modal-backdrop" onMouseDown={() => setEditing(null)}>
          <form
            className="app-form"
            onMouseDown={(event) => event.stopPropagation()}
            onSubmit={submit}
          >
            <div className="form-heading">
              <h2>{editing === "new" ? "Nuevo Cajón" : "Configurar Cajón"}</h2>
              <button
                aria-label="Cerrar"
                className="icon-button"
                onClick={() => setEditing(null)}
                type="button"
              >
                ×
              </button>
            </div>
            <label>
              Nombre
              <input
                defaultValue={editing === "new" ? "" : editing.name}
                name="name"
                required
              />
            </label>
            <label>
              Código
              <input
                defaultValue={editing === "new" ? "" : editing.code}
                name="code"
                pattern="[A-Z][A-Z0-9_]{1,63}"
                required
              />
            </label>
            <label>
              Descripción
              <textarea
                defaultValue={editing === "new" ? "" : editing.description}
                name="description"
              />
            </label>
            <fieldset className="block-app-selector">
              <div className="block-selector-head">
                <legend>Apps maestras</legend>
                <strong>{selected.length} seleccionadas</strong>
              </div>
              <input
                aria-label="Buscar Apps"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Buscar Apps..."
                value={query}
              />
              <div className="block-selector-actions">
                <button
                  onClick={() =>
                    setSelected((current) => [
                      ...new Set([
                        ...current,
                        ...visibleApps.map((app) => app.id),
                      ]),
                    ])
                  }
                  type="button"
                >
                  Seleccionar visibles
                </button>
                <button onClick={() => setSelected([])} type="button">
                  Limpiar
                </button>
              </div>
              <div className="block-app-list">
                {visibleApps.map((app) => (
                  <label className="block-app-row" key={app.id}>
                    <input
                      checked={selected.includes(app.id)}
                      onChange={() => toggle(app.id)}
                      type="checkbox"
                    />
                    <span>
                      <strong>{app.name}</strong>
                      <small>
                        {app.code}
                        <br />
                        {app.allowedGeometries.join(", ")} · Versión actual
                      </small>
                    </span>
                  </label>
                ))}
              </div>
            </fieldset>
            <button className="primary-button" disabled={saving} type="submit">
              Guardar Cajón
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
