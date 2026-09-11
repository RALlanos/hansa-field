"use client";

import { useEffect, useState } from "react";
import { segmentationApi, type Scheme } from "./contracts";

export function LevelsEditor({
  scheme,
  onSaved,
  onManageZones,
}: {
  scheme: Scheme;
  onSaved: () => Promise<void>;
  onManageZones: () => void;
}) {
  const [names, setNames] = useState<Record<string, string>>({});
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setNames(Object.fromEntries(scheme.levels.map((level) => [level.id, level.name])));
  }, [scheme.id, scheme.revision, scheme.levels]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await onSaved();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo guardar el nivel.");
    } finally {
      setBusy(false);
    }
  };

  const saveLevelName = (id: string) => {
    const name = names[id]?.trim();
    const level = scheme.levels.find((item) => item.id === id);
    if (!name || !level || name === level.name) return;
    void run(async () => {
      await segmentationApi(`/schemes/${scheme.id}/levels/${id}`, { name }, "PATCH");
    });
  };

  const moveLevel = (index: number, offset: number) => {
    const levelIds = scheme.levels.map((level) => level.id);
    const [id] = levelIds.splice(index, 1);
    levelIds.splice(index + offset, 0, id!);
    void run(async () => {
      await segmentationApi(`/schemes/${scheme.id}/levels/order`, { levelIds });
    });
  };

  return (
    <section className="levels-builder">
      <header className="levels-builder-header">
        <div>
          <p className="seg-kicker">Estructura</p>
          <h2>Define los niveles</h2>
          <p>Agrega uno por cada paso de la clasificación. Puedes crear cinco o más niveles.</p>
        </div>
        {scheme.levels.length ? (
          <button onClick={onManageZones} type="button">Modificar zonas creadas</button>
        ) : null}
      </header>
      {error ? <p className="seg-error" role="alert">{error}</p> : null}
      <div className="levels-canvas" aria-label="Niveles de la estructura">
        {!scheme.levels.length ? (
          <div className="levels-empty">
            <strong>La estructura todavía no tiene niveles.</strong>
            <span>Ejemplo: Región → Sector → Nodo → Equipo.</span>
          </div>
        ) : null}
        {scheme.levels.map((level, index) => (
          <div
            className="level-card"
            key={level.id}
            style={{ marginInlineStart: `${Math.min(index * 1.35, 5.4)}rem` }}
          >
            <span className="level-number">{index + 1}</span>
            <div className="level-card-body">
              <small>Nivel {index + 1}</small>
              <input
                aria-label={`Nombre del nivel ${index + 1}`}
                disabled={busy || level.status === "archived"}
                onBlur={() => saveLevelName(level.id)}
                onChange={(event) => setNames({ ...names, [level.id]: event.target.value })}
                value={names[level.id] ?? ""}
              />
              {level.status === "archived" ? <em>Archivado</em> : null}
            </div>
            <div className="level-actions">
              <button
                aria-label={`Subir ${level.name}`}
                disabled={busy || index === 0}
                onClick={() => moveLevel(index, -1)}
                type="button"
              >
                ↑
              </button>
              <button
                aria-label={`Bajar ${level.name}`}
                disabled={busy || index === scheme.levels.length - 1}
                onClick={() => moveLevel(index, 1)}
                type="button"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>
      <form
        className="add-level-form"
        onSubmit={(event) => {
          event.preventDefault();
          const name = newName.trim();
          if (!name) return;
          void run(async () => {
            await segmentationApi(`/schemes/${scheme.id}/levels`, { name, configuration: {} });
            setNewName("");
          });
        }}
      >
        <label>
          Nuevo nivel
          <input
            disabled={busy || scheme.status !== "active"}
            onChange={(event) => setNewName(event.target.value)}
            placeholder={`Nivel ${scheme.levels.length + 1}`}
            value={newName}
          />
        </label>
        <button className="seg-primary" disabled={busy || scheme.status !== "active" || !newName.trim()} type="submit">
          + Agregar nivel
        </button>
      </form>
    </section>
  );
}
