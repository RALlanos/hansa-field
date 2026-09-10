"use client";

import { useEffect, useState } from "react";
import { segmentationApi, type Page, type Segment, type Scheme } from "./contracts";

export function SegmentTree({
  scheme,
  onSaved,
}: {
  scheme: Scheme;
  onSaved: () => Promise<void>;
}) {
  const [parent, setParent] = useState<Segment | null>(null);
  const [children, setChildren] = useState<Page<Segment>>({ items: [], nextCursor: null });
  const [path, setPath] = useState<{ id: string; name: string }[]>([]);
  const [cursor, setCursor] = useState("");
  const [selected, setSelected] = useState<Segment | null>(null);
  const [moving, setMoving] = useState<Segment | null>(null);
  const [draft, setDraft] = useState<Partial<Segment> | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    const query = new URLSearchParams();
    if (parent) query.set("parentId", parent.id);
    if (cursor) query.set("cursor", cursor);
    void Promise.all([
      segmentationApi<Page<Segment>>(`/schemes/${scheme.id}/children?${query}`),
      parent
        ? segmentationApi<{ id: string; name: string }[]>(`/segments/${parent.id}/ancestors`)
        : Promise.resolve([]),
    ])
      .then(([nextChildren, ancestors]) => {
        if (!active) return;
        setChildren(nextChildren);
        setPath(ancestors);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : "No se pudieron cargar las zonas.");
      });
    return () => {
      active = false;
    };
  }, [scheme.id, scheme.revision, parent, cursor]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar la zona.");
    } finally {
      setBusy(false);
    }
  };

  const openFolder = (segment: Segment | null) => {
    setParent(segment);
    setCursor("");
    setDraft(null);
    setSelected(null);
  };

  const beginEdit = (segment: Segment | null) => {
    const nextLevel = scheme.levels.find(
      (level) =>
        level.status === "active" &&
        (!parent || level.position > (scheme.levels.find((item) => item.id === parent.levelId)?.position ?? 0)),
    );
    setSelected(segment);
    setDraft(segment ?? {
      levelId: nextLevel?.id ?? "",
      parentSegmentId: parent?.id ?? null,
      name: "",
      code: "",
      externalId: "",
      description: "",
      status: "active",
    });
  };

  return (
    <section className="zones-builder">
      <header className="levels-builder-header">
        <div>
          <p className="seg-kicker">Zonas creadas</p>
          <h2>Crear y modificar zonas</h2>
          <p>Las zonas forman el árbol de esta estructura. La asignación de registros se realizará después.</p>
        </div>
      </header>
      {error ? <p className="seg-error" role="alert">{error}</p> : null}
      <nav className="seg-breadcrumb" aria-label="Ruta de zonas">
        <button onClick={() => openFolder(null)} type="button">Inicio</button>
        {path.map((item) => (
          <button
            key={item.id}
            onClick={() => void run(async () => openFolder(await segmentationApi<Segment>(`/segments/${item.id}`)))}
            type="button"
          >
            {item.name}
          </button>
        ))}
        {parent ? <strong>{parent.name}</strong> : null}
      </nav>
      {moving ? (
        <div className="seg-notice">
          Moviendo “{moving.name}” a esta zona.
          <div className="seg-actions">
            <button
              className="seg-primary"
              disabled={busy}
              onClick={() => void run(async () => {
                await segmentationApi(`/segments/${moving.id}/move`, { parentSegmentId: parent?.id ?? null });
                setMoving(null);
              })}
              type="button"
            >
              Mover aquí
            </button>
            <button onClick={() => setMoving(null)} type="button">Cancelar</button>
          </div>
        </div>
      ) : null}
      <div className="zones-actions">
        <button
          className="seg-primary"
          disabled={scheme.status !== "active" || !scheme.levels.some((level) => level.status === "active")}
          onClick={() => beginEdit(null)}
          type="button"
        >
          + Nueva zona aquí
        </button>
      </div>
      <div className="zones-list">
        {children.items.map((segment) => (
          <article className="seg-row" key={segment.id}>
            <span>
              <strong>{segment.hasChildren ? "▸ " : "• "}{segment.name}</strong>
              <small>{scheme.levels.find((level) => level.id === segment.levelId)?.name}{segment.code ? ` · ${segment.code}` : ""}</small>
            </span>
            <div className="seg-actions">
              {segment.hasChildren ? <button onClick={() => openFolder(segment)} type="button">Abrir</button> : null}
              <button onClick={() => beginEdit(segment)} type="button">Modificar</button>
              <button disabled={busy || scheme.status !== "active"} onClick={() => setMoving(segment)} type="button">Mover</button>
            </div>
          </article>
        ))}
        {!children.items.length ? <p className="seg-empty-list">Aún no hay zonas dentro de este nivel.</p> : null}
      </div>
      <div className="seg-actions">
        <button disabled={!cursor} onClick={() => setCursor("")} type="button">Inicio</button>
        <button disabled={!children.nextCursor} onClick={() => setCursor(children.nextCursor ?? "")} type="button">Ver más zonas</button>
      </div>
      {draft ? (
        <form
          className="seg-panel zone-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run(async () => {
              const payload = {
                levelId: draft.levelId,
                parentSegmentId: draft.parentSegmentId ?? null,
                name: draft.name,
                code: draft.code || null,
                externalId: draft.externalId || null,
                description: draft.description ?? "",
                status: draft.status ?? "active",
              };
              const saved = await segmentationApi<Segment>(
                selected ? `/segments/${selected.id}` : `/schemes/${scheme.id}/segments`,
                payload,
                selected ? "PATCH" : "POST",
              );
              setSelected(saved);
              setDraft(null);
            });
          }}
        >
          <div className="seg-panel-heading">
            <div>
              <p className="seg-kicker">Zona</p>
              <h3>{selected ? "Modificar zona" : "Nueva zona"}</h3>
            </div>
            <button onClick={() => { setDraft(null); setSelected(null); }} type="button">Cerrar</button>
          </div>
          <label>
            Nivel
            <select
              onChange={(event) => setDraft({ ...draft, levelId: event.target.value })}
              required
              value={draft.levelId ?? ""}
            >
              <option value="">Seleccionar nivel</option>
              {scheme.levels.filter((level) => level.status === "active").map((level) => (
                <option key={level.id} value={level.id}>{level.position}. {level.name}</option>
              ))}
            </select>
          </label>
          <label>
            Nombre de la zona
            <input onChange={(event) => setDraft({ ...draft, name: event.target.value })} required value={draft.name ?? ""} />
          </label>
          <label>
            Código (opcional)
            <input onChange={(event) => setDraft({ ...draft, code: event.target.value })} value={draft.code ?? ""} />
          </label>
          <label>
            Descripción (opcional)
            <textarea onChange={(event) => setDraft({ ...draft, description: event.target.value })} value={draft.description ?? ""} />
          </label>
          {selected ? (
            <label>
              Estado
              <select onChange={(event) => setDraft({ ...draft, status: event.target.value === "active" ? "active" : "archived" })} value={draft.status ?? "active"}>
                <option value="active">Activa</option>
                <option value="archived">Archivada</option>
              </select>
            </label>
          ) : null}
          <div className="seg-actions">
            <button className="seg-primary" disabled={busy || scheme.status !== "active"} type="submit">Guardar zona</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
